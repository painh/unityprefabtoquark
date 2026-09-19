import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { parseUnityYaml } from '../parser/unity-yaml.js';
import { convertPrefabToQuarks } from '../converter/particle-converter.js';
import { resolveTexturesFromPrefab, resolveMaterialsFromPrefab } from '../parser/asset-resolver.js';
import {
  generateShaderPrompt,
  saveToCache,
  listCachedShaders,
  clearShaderCache,
  checkShaderCache,
} from '../converter/shader-prompt-generator.js';

const app = express();
const PORT = 3030;

app.use(cors());
app.use(express.json());

// 폴더 내용 조회
app.get('/api/browse', async (req, res) => {
  try {
    const dirPath = req.query.path as string;
    if (!dirPath) {
      return res.status(400).json({ error: 'path parameter required' });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = entries
      .filter(entry => {
        const name = entry.name;
        // 숨김 파일 제외, prefab/폴더만 표시
        if (name.startsWith('.')) return false;
        if (entry.isDirectory()) return true;
        return name.endsWith('.prefab');
      })
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isPrefab: entry.name.endsWith('.prefab'),
      }));

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Prefab 파일 읽기 및 파싱
app.get('/api/prefab', async (req, res) => {
  try {
    const prefabPath = req.query.path as string;
    if (!prefabPath) {
      return res.status(400).json({ error: 'path parameter required' });
    }

    const content = await fs.readFile(prefabPath, 'utf-8');
    const parsed = parseUnityYaml(content);

    res.json({ parsed });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Prefab → three.quarks 변환
app.post('/api/convert', async (req, res) => {
  try {
    const { prefabPath, assetsRoot, outputRoot } = req.body;

    if (!prefabPath || !assetsRoot || !outputRoot) {
      return res.status(400).json({
        error: 'prefabPath, assetsRoot, outputRoot required'
      });
    }

    const result = await convertPrefabToQuarks({
      prefabPath,
      assetsRoot,
      outputRoot,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 변환된 JSON 미리보기용 조회
app.get('/api/preview', async (req, res) => {
  // 로그 수집
  const logs: Array<{ type: string; message: string }> = [];
  const addLog = (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    logs.push({ type, message });
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  try {
    const prefabPath = req.query.path as string;
    const assetsRoot = req.query.assetsRoot as string;

    if (!prefabPath) {
      return res.status(400).json({ error: 'path parameter required' });
    }

    addLog(`Prefab 로드: ${prefabPath}`);

    // assetsRoot가 제공되지 않으면 prefab 위치에서 Assets 폴더 추정
    const effectiveAssetsRoot = assetsRoot || findAssetsRoot(prefabPath);
    addLog(`Assets 루트: ${effectiveAssetsRoot}`);

    const content = await fs.readFile(prefabPath, 'utf-8');
    addLog(`파일 읽기 완료 (${content.length} bytes)`);

    const parsed = parseUnityYaml(content);
    addLog(`YAML 파싱 완료 - ${parsed.particleSystems.length}개 ParticleSystem 발견`);

    // 각 파티클 시스템 정보 로깅
    for (const ps of parsed.particleSystems) {
      addLog(`  - ParticleSystem (FileID: ${ps.fileId})`);
      addLog(`    Duration: ${ps.main.duration}s, Loop: ${ps.main.loop}`);
      addLog(`    Emission: ${ps.emission.rateOverTime?.constant || 'curve'}/s`);
      if (ps.shape.enabled) {
        const shapeTypes = ['Sphere', 'Hemisphere', 'Cone', 'Box', 'Mesh', 'MeshRenderer', 'SkinnedMesh', 'Circle', 'Edge'];
        addLog(`    Shape: ${shapeTypes[ps.shape.type] || 'Unknown'}`);
      }
      if (ps.colorOverLifetime.enabled) {
        addLog(`    ColorOverLifetime: 활성화`);
      }
      if (ps.sizeOverLifetime.enabled) {
        addLog(`    SizeOverLifetime: 활성화`);
      }
      if (ps.textureSheetAnimation.enabled) {
        addLog(`    TextureSheet: ${ps.textureSheetAnimation.tilesX}x${ps.textureSheetAnimation.tilesY}`);
      }
    }

    const quarksJson = await convertPrefabToQuarks({
      prefabPath,
      assetsRoot: effectiveAssetsRoot,
      outputRoot: '',
      previewOnly: true,
    });

    addLog(`변환 완료 - ${quarksJson.quarksJson.particleSystems.length}개 시스템 생성`);

    // 변환 경고 로깅 (미지원/부분 지원 기능)
    if (quarksJson.warnings && quarksJson.warnings.length > 0) {
      addLog(`⚠️ 변환 경고 ${quarksJson.warnings.length}개:`, 'warning');
      for (const warning of quarksJson.warnings) {
        addLog(`  ${warning}`, 'warning');
      }
    }

    // Material/Shader 정보 추출 및 로깅
    const materials = await resolveMaterialsFromPrefab(prefabPath, effectiveAssetsRoot);
    if (materials.length > 0) {
      addLog(`Material ${materials.length}개 발견:`);
      for (const mat of materials) {
        addLog(`  📦 ${mat.name}`);
        addLog(`    Shader: ${mat.shader.name}`);
        if (mat.shader.path) {
          addLog(`    Shader 경로: ${path.basename(mat.shader.path)}`);
        }

        // 블렌드 모드 해석
        const blendModes: Record<number, string> = {
          0: 'Zero', 1: 'One', 2: 'DstColor', 3: 'SrcColor',
          4: 'OneMinusDstColor', 5: 'SrcAlpha', 6: 'OneMinusSrcColor',
          7: 'DstAlpha', 8: 'OneMinusDstAlpha', 9: 'SrcAlphaSaturate',
          10: 'OneMinusSrcAlpha'
        };
        const srcBlend = blendModes[mat.blendMode.srcBlend] || String(mat.blendMode.srcBlend);
        const dstBlend = blendModes[mat.blendMode.dstBlend] || String(mat.blendMode.dstBlend);
        addLog(`    BlendMode: ${srcBlend} → ${dstBlend}, ZWrite: ${mat.blendMode.zWrite === 1 ? 'On' : 'Off'}`);

        // 텍스처
        if (mat.properties.textures.length > 0) {
          addLog(`    텍스처 ${mat.properties.textures.length}개:`);
          for (const tex of mat.properties.textures) {
            const texName = tex.path ? path.basename(tex.path) : tex.guid.substring(0, 8) + '...';
            addLog(`      ${tex.name}: ${texName}`);
          }
        }

        // 주요 색상
        const mainColor = mat.properties.colors.find(c => c.name === '_Color');
        if (mainColor) {
          const c = mainColor.value;
          addLog(`    Color: rgba(${c.r.toFixed(2)}, ${c.g.toFixed(2)}, ${c.b.toFixed(2)}, ${c.a.toFixed(2)})`);
        }
      }
    } else {
      addLog('Material을 찾을 수 없음', 'warning');
    }

    // 텍스처 경로 찾기
    const textures = await resolveTexturesFromPrefab(prefabPath, effectiveAssetsRoot);
    if (textures.length > 0) {
      addLog(`텍스처 ${textures.length}개 발견:`);
      for (const tex of textures) {
        addLog(`  - ${path.basename(tex)}`);
      }
    } else {
      addLog('텍스처를 찾을 수 없음', 'warning');
    }

    // 텍스처 경로를 URL로 변환
    const textureUrls = textures.map(texPath => `/api/texture?path=${encodeURIComponent(texPath)}`);

    // 디버그: 파싱된 파티클 시스템 색상 정보 출력
    if (quarksJson.quarksJson?.particleSystems) {
      for (const ps of quarksJson.quarksJson.particleSystems) {
        if (ps.startColor?.color) {
          const c = ps.startColor.color;
          addLog(`  StartColor: rgba(${c.r.toFixed(2)}, ${c.g.toFixed(2)}, ${c.b.toFixed(2)}, ${c.a.toFixed(2)})`);
        }
        if (ps.behaviors?.length) {
          addLog(`  Behaviors: ${ps.behaviors.map((b: { type: string }) => b.type).join(', ')}`);
        }
      }
    }

    // Material 정보를 클라이언트에 전달
    const materialInfo = materials.length > 0 ? {
      blendMode: materials[0].blendMode,
      color: materials[0].properties.colors.find(c => c.name === '_Color')?.value,
      shaderName: materials[0].shader.name,
    } : null;

    res.json({
      ...quarksJson,
      textures: textureUrls,
      textureAbsolutePaths: textures,
      materialInfo,
      conversionInfo: quarksJson.conversionInfo,
      logs,
    });
  } catch (error) {
    addLog(`에러 발생: ${String(error)}`, 'error');
    console.error('Preview 에러:', error);
    res.status(500).json({ error: String(error), logs });
  }
});

// prefabPath에서 Assets 폴더 경로 추정
function findAssetsRoot(prefabPath: string): string {
  const parts = prefabPath.split(path.sep);
  const assetsIndex = parts.findIndex(p => p === 'Assets');
  if (assetsIndex !== -1) {
    return parts.slice(0, assetsIndex + 1).join(path.sep);
  }
  return path.dirname(prefabPath);
}

// 텍스처 파일 서빙
app.get('/api/texture', async (req, res) => {
  try {
    const texturePath = req.query.path as string;
    if (!texturePath) {
      return res.status(400).json({ error: 'path parameter required' });
    }

    // 파일 존재 확인
    await fs.access(texturePath);

    // Content-Type 설정
    const ext = path.extname(texturePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.tga': 'image/x-tga',
      '.bmp': 'image/bmp',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    const fileBuffer = await fs.readFile(texturePath);
    res.send(fileBuffer);
  } catch (error) {
    console.error('텍스처 로드 에러:', error);
    res.status(404).json({ error: `Texture not found: ${req.query.path}` });
  }
});

// =========================================
// 쉐이더 변환 관련 API
// =========================================

// 프로젝트 루트 경로 (캐시 저장용)
const PROJECT_ROOT = process.cwd();

// 쉐이더 프롬프트 생성
app.get('/api/shader-prompt', async (req, res) => {
  try {
    const prefabPath = req.query.prefabPath as string;
    const assetsRoot = req.query.assetsRoot as string;

    if (!prefabPath) {
      return res.status(400).json({ error: 'prefabPath parameter required' });
    }

    const effectiveAssetsRoot = assetsRoot || findAssetsRoot(prefabPath);

    // Material 정보 추출
    const materials = await resolveMaterialsFromPrefab(prefabPath, effectiveAssetsRoot);

    if (materials.length === 0) {
      return res.json({
        success: false,
        error: 'Material을 찾을 수 없습니다',
        materials: [],
      });
    }

    // 각 Material에 대해 프롬프트 생성
    const results = await Promise.all(
      materials.map(async (mat) => {
        const promptResult = await generateShaderPrompt(mat, PROJECT_ROOT);
        return {
          materialName: mat.name,
          shaderGuid: mat.shader.guid,
          shaderName: promptResult.shaderName,
          shaderPath: promptResult.shaderPath,
          cacheStatus: promptResult.cacheStatus,
          cachedMaterialPath: promptResult.cachedMaterialPath,
          prompt: promptResult.prompt,
        };
      })
    );

    // 첫 번째 Material의 정보를 메인으로 반환 (단일 쉐이더 지원)
    const mainResult = results[0] || {};

    res.json({
      success: true,
      // 단일 결과 (첫 번째 Material)
      shaderGuid: mainResult.shaderGuid,
      shaderName: mainResult.shaderName,
      shaderPath: mainResult.shaderPath,
      cacheStatus: mainResult.cacheStatus,
      cachedMaterialPath: mainResult.cachedMaterialPath,
      prompt: mainResult.prompt,
      // 전체 목록
      materials: results,
    });
  } catch (error) {
    console.error('쉐이더 프롬프트 생성 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 쉐이더 캐시에 등록 (LLM이 이미 파일을 저장한 경우)
app.post('/api/shader-cache', async (req, res) => {
  try {
    const { shaderGuid, shaderPath, shaderName, materialPath } = req.body;

    if (!shaderGuid || !shaderPath || !shaderName) {
      return res.status(400).json({
        error: 'shaderGuid, shaderPath, shaderName required',
      });
    }

    // 예상되는 출력 파일 경로 계산
    const safeShaderName = shaderName.replace(/[^a-zA-Z0-9]/g, '_');
    const expectedPath = path.join(PROJECT_ROOT, '.shader-cache', `${safeShaderName}.ts`);

    // 파일이 존재하는지 확인
    try {
      await fs.access(expectedPath);
    } catch {
      return res.status(404).json({
        error: `파일이 존재하지 않습니다: ${expectedPath}`,
        expectedPath,
      });
    }

    // 파일 내용 읽기
    const code = await fs.readFile(expectedPath, 'utf-8');

    // 캐시 인덱스에 등록
    const outputPath = await saveToCache(
      PROJECT_ROOT,
      shaderGuid,
      shaderPath,
      shaderName,
      materialPath || '',
      code
    );

    res.json({
      success: true,
      outputPath,
      message: `쉐이더가 캐시에 등록되었습니다: ${outputPath}`,
    });
  } catch (error) {
    console.error('쉐이더 캐시 등록 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 캐시된 쉐이더 목록 조회
app.get('/api/shader-cache/list', async (req, res) => {
  try {
    const entries = await listCachedShaders(PROJECT_ROOT);
    res.json({
      success: true,
      count: entries.length,
      entries,
    });
  } catch (error) {
    console.error('쉐이더 캐시 목록 조회 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 캐시 상태 확인
app.get('/api/shader-cache/check', async (req, res) => {
  try {
    const shaderGuid = req.query.guid as string;
    const shaderPath = req.query.path as string;

    if (!shaderGuid) {
      return res.status(400).json({ error: 'guid parameter required' });
    }

    const result = await checkShaderCache(PROJECT_ROOT, shaderGuid, shaderPath);
    res.json({
      cached: result.cached,
      entry: result.entry,
      hashChanged: result.hashChanged,
    });
  } catch (error) {
    console.error('쉐이더 캐시 확인 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 캐시 클리어
app.delete('/api/shader-cache', async (req, res) => {
  try {
    await clearShaderCache(PROJECT_ROOT);
    res.json({
      success: true,
      message: '쉐이더 캐시가 삭제되었습니다',
    });
  } catch (error) {
    console.error('쉐이더 캐시 삭제 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 캐시된 쉐이더 코드 읽기
app.get('/api/shader-cache/code', async (req, res) => {
  try {
    const shaderGuid = req.query.shaderGuid as string;
    const filePath = req.query.path as string;

    let codeFilePath = filePath;

    // shaderGuid로 조회하는 경우
    if (shaderGuid && !filePath) {
      const result = await checkShaderCache(PROJECT_ROOT, shaderGuid);
      if (!result.cached || !result.entry) {
        return res.status(404).json({ error: '캐시된 쉐이더를 찾을 수 없습니다' });
      }
      codeFilePath = result.entry.outputPath;
    }

    if (!codeFilePath) {
      return res.status(400).json({ error: 'shaderGuid or path parameter required' });
    }

    const code = await fs.readFile(codeFilePath, 'utf-8');
    res.json({
      success: true,
      code,
    });
  } catch (error) {
    console.error('쉐이더 코드 읽기 에러:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
