import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { parseUnityYaml } from '../parser/unity-yaml.js';
import { convertPrefabToQuarks } from '../converter/particle-converter.js';
import { resolveTexturesFromPrefab } from '../parser/asset-resolver.js';

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
  try {
    const prefabPath = req.query.path as string;
    const assetsRoot = req.query.assetsRoot as string;

    if (!prefabPath) {
      return res.status(400).json({ error: 'path parameter required' });
    }

    // assetsRoot가 제공되지 않으면 prefab 위치에서 Assets 폴더 추정
    const effectiveAssetsRoot = assetsRoot || findAssetsRoot(prefabPath);

    const content = await fs.readFile(prefabPath, 'utf-8');
    const parsed = parseUnityYaml(content);
    const quarksJson = await convertPrefabToQuarks({
      prefabPath,
      assetsRoot: effectiveAssetsRoot,
      outputRoot: '',
      previewOnly: true,
    });

    // 텍스처 경로 찾기
    const textures = await resolveTexturesFromPrefab(prefabPath, effectiveAssetsRoot);
    console.log('찾은 텍스처들:', textures);

    // 텍스처 경로를 URL로 변환
    // /textures?path=절대경로 형식 사용
    const textureUrls = textures.map(texPath => `/api/texture?path=${encodeURIComponent(texPath)}`);

    // 디버그: 파싱된 파티클 시스템 색상 정보 출력
    if (quarksJson.quarksJson?.particleSystems) {
      for (const ps of quarksJson.quarksJson.particleSystems) {
        console.log('=== 변환된 파티클 시스템 ===');
        console.log('이름:', ps.name);
        console.log('startColor:', JSON.stringify(ps.startColor, null, 2));
        console.log('behaviors:', JSON.stringify(ps.behaviors, null, 2));
      }
    }

    res.json({
      ...quarksJson,
      textures: textureUrls,
      textureAbsolutePaths: textures,
    });
  } catch (error) {
    console.error('Preview 에러:', error);
    res.status(500).json({ error: String(error) });
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
