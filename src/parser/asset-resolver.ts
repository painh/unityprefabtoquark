import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';

/**
 * GUID로 .meta 파일을 찾아 실제 에셋 경로 반환
 */
export async function resolveGuidToPath(
  guid: string,
  assetsRoot: string
): Promise<string | null> {
  // Assets 폴더 전체를 재귀 탐색해서 해당 GUID를 가진 .meta 파일 찾기
  const metaPath = await findMetaFileByGuid(guid, assetsRoot);
  if (metaPath) {
    // .meta 확장자 제거하면 실제 파일 경로
    return metaPath.replace(/\.meta$/, '');
  }
  return null;
}

/**
 * Assets 폴더에서 특정 GUID를 가진 .meta 파일 찾기
 */
async function findMetaFileByGuid(
  guid: string,
  dir: string
): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 재귀 탐색
        const found = await findMetaFileByGuid(guid, fullPath);
        if (found) return found;
      } else if (entry.name.endsWith('.meta')) {
        // .meta 파일에서 GUID 확인
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.includes(`guid: ${guid}`)) {
            return fullPath;
          }
        } catch {
          // 파일 읽기 실패 무시
        }
      }
    }
  } catch {
    // 디렉토리 읽기 실패 무시
  }

  return null;
}

/**
 * Material 파일에서 MainTex 텍스처 GUID 추출
 */
export async function extractTextureFromMaterial(
  materialPath: string
): Promise<{ guid: string; textureName: string } | null> {
  try {
    const content = await fs.readFile(materialPath, 'utf-8');

    // Unity Material 파일 파싱
    // %YAML, %TAG 헤더 제거
    const cleanContent = content
      .replace(/%YAML.*\n/g, '')
      .replace(/%TAG.*\n/g, '');

    // --- 구분자로 문서 분리
    const documents = cleanContent.split(/^---\s*/m).filter(doc => doc.trim());

    for (const doc of documents) {
      // Material 클래스 확인 (!u!21)
      if (!doc.includes('!u!21')) continue;

      const yamlContent = doc.replace(/^!u!\d+\s+&\d+\s*\n?/, '');

      try {
        const parsed = YAML.parse(yamlContent);
        if (!parsed?.Material) continue;

        const material = parsed.Material;

        // m_SavedProperties.m_TexEnvs 에서 텍스처 찾기
        const texEnvs = material.m_SavedProperties?.m_TexEnvs;
        if (!texEnvs) continue;

        // _MainTex 찾기
        for (const texEnv of texEnvs) {
          if (texEnv._MainTex) {
            const texture = texEnv._MainTex.m_Texture;
            if (texture?.guid) {
              return {
                guid: texture.guid,
                textureName: '_MainTex',
              };
            }
          }
          // 다른 텍스처 이름들도 시도
          const keys = Object.keys(texEnv);
          for (const key of keys) {
            const tex = texEnv[key]?.m_Texture;
            if (tex?.guid) {
              return {
                guid: tex.guid,
                textureName: key,
              };
            }
          }
        }
      } catch {
        // YAML 파싱 실패 무시
      }
    }
  } catch (error) {
    console.error('Material 파일 읽기 실패:', error);
  }

  return null;
}

/**
 * Prefab에서 ParticleSystemRenderer의 Material 정보 추출
 */
export function extractMaterialFromPrefab(
  prefabContent: string
): { guid: string; fileID: number } | null {
  // ParticleSystemRenderer (!u!199) 찾기
  const rendererMatch = prefabContent.match(
    /---\s*!u!199\s+&(\d+)[\s\S]*?m_Materials:[\s\S]*?-\s*\{fileID:\s*(\d+),\s*guid:\s*([a-f0-9]+)/
  );

  if (rendererMatch) {
    return {
      guid: rendererMatch[3],
      fileID: parseInt(rendererMatch[2], 10),
    };
  }

  // 간단한 패턴으로 다시 시도
  const simpleMatch = prefabContent.match(/guid:\s*([a-f0-9]{32})/);
  if (simpleMatch) {
    return {
      guid: simpleMatch[1],
      fileID: 0,
    };
  }

  return null;
}

/**
 * Prefab에서 사용하는 모든 텍스처 경로 추출
 */
export async function resolveTexturesFromPrefab(
  prefabPath: string,
  assetsRoot: string
): Promise<string[]> {
  const textures: string[] = [];

  try {
    const prefabContent = await fs.readFile(prefabPath, 'utf-8');

    // Prefab에서 모든 GUID 추출
    const guidMatches = prefabContent.matchAll(/guid:\s*([a-f0-9]{32})/g);

    for (const match of guidMatches) {
      const guid = match[1];

      // GUID로 에셋 경로 찾기
      const assetPath = await resolveGuidToPath(guid, assetsRoot);
      if (!assetPath) continue;

      // Material 파일인 경우 텍스처 추출
      if (assetPath.endsWith('.mat')) {
        const textureInfo = await extractTextureFromMaterial(assetPath);
        if (textureInfo) {
          const texturePath = await resolveGuidToPath(textureInfo.guid, assetsRoot);
          if (texturePath) {
            textures.push(texturePath);
          }
        }
      }
      // 직접 텍스처 파일인 경우
      else if (/\.(png|jpg|jpeg|tga|psd|gif|bmp)$/i.test(assetPath)) {
        textures.push(assetPath);
      }
    }
  } catch (error) {
    console.error('텍스처 추출 실패:', error);
  }

  return [...new Set(textures)]; // 중복 제거
}

/**
 * Material 정보 인터페이스
 */
export interface MaterialInfo {
  name: string;
  path: string;
  guid: string;
  shader: {
    name: string;
    guid: string;
    path?: string;
  };
  properties: {
    textures: Array<{
      name: string;
      guid: string;
      path?: string;
    }>;
    colors: Array<{
      name: string;
      value: { r: number; g: number; b: number; a: number };
    }>;
    floats: Array<{
      name: string;
      value: number;
    }>;
  };
  blendMode: {
    srcBlend: number;
    dstBlend: number;
    zWrite: number;
  };
}

/**
 * Material 파일에서 상세 정보 추출
 */
export async function extractMaterialInfo(
  materialPath: string,
  assetsRoot: string
): Promise<MaterialInfo | null> {
  try {
    const content = await fs.readFile(materialPath, 'utf-8');

    // Unity Material 파일 파싱
    const cleanContent = content
      .replace(/%YAML.*\n/g, '')
      .replace(/%TAG.*\n/g, '');

    const documents = cleanContent.split(/^---\s*/m).filter(doc => doc.trim());

    for (const doc of documents) {
      if (!doc.includes('!u!21')) continue;

      const yamlContent = doc.replace(/^!u!\d+\s+&\d+\s*\n?/, '');

      try {
        const parsed = YAML.parse(yamlContent);
        if (!parsed?.Material) continue;

        const material = parsed.Material;

        // Shader 정보
        const shaderRef = material.m_Shader;
        let shaderInfo = {
          name: 'Unknown',
          guid: shaderRef?.guid || '',
          path: undefined as string | undefined,
        };

        if (shaderRef?.guid) {
          const shaderPath = await resolveGuidToPath(shaderRef.guid, assetsRoot);
          if (shaderPath) {
            shaderInfo.path = shaderPath;
            // 셰이더 이름 추출
            try {
              const shaderContent = await fs.readFile(shaderPath, 'utf-8');
              const nameMatch = shaderContent.match(/Shader\s+"([^"]+)"/);
              if (nameMatch) {
                shaderInfo.name = nameMatch[1];
              }
            } catch {
              shaderInfo.name = path.basename(shaderPath, '.shader');
            }
          }
        }

        // 텍스처 추출
        const textures: MaterialInfo['properties']['textures'] = [];
        const texEnvs = material.m_SavedProperties?.m_TexEnvs;
        if (texEnvs) {
          for (const texEnv of texEnvs) {
            const keys = Object.keys(texEnv);
            for (const key of keys) {
              const tex = texEnv[key]?.m_Texture;
              if (tex?.guid) {
                const texPath = await resolveGuidToPath(tex.guid, assetsRoot);
                textures.push({
                  name: key,
                  guid: tex.guid,
                  path: texPath || undefined,
                });
              }
            }
          }
        }

        // 색상 추출
        const colors: MaterialInfo['properties']['colors'] = [];
        const colorProps = material.m_SavedProperties?.m_Colors;
        if (colorProps) {
          for (const colorProp of colorProps) {
            const keys = Object.keys(colorProp);
            for (const key of keys) {
              const color = colorProp[key];
              if (color && typeof color === 'object') {
                colors.push({
                  name: key,
                  value: {
                    r: color.r ?? 1,
                    g: color.g ?? 1,
                    b: color.b ?? 1,
                    a: color.a ?? 1,
                  },
                });
              }
            }
          }
        }

        // Float 추출
        const floats: MaterialInfo['properties']['floats'] = [];
        const floatProps = material.m_SavedProperties?.m_Floats;
        if (floatProps) {
          for (const floatProp of floatProps) {
            const keys = Object.keys(floatProp);
            for (const key of keys) {
              floats.push({
                name: key,
                value: floatProp[key] ?? 0,
              });
            }
          }
        }

        // 블렌드 모드
        const srcBlend = floats.find(f => f.name === '_SrcBlend')?.value ?? 1;
        const dstBlend = floats.find(f => f.name === '_DstBlend')?.value ?? 0;
        const zWrite = floats.find(f => f.name === '_ZWrite')?.value ?? 1;

        // Material GUID 추출 (.meta 파일에서)
        let materialGuid = '';
        try {
          const metaContent = await fs.readFile(materialPath + '.meta', 'utf-8');
          const guidMatch = metaContent.match(/guid:\s*([a-f0-9]{32})/);
          if (guidMatch) {
            materialGuid = guidMatch[1];
          }
        } catch {}

        return {
          name: material.m_Name || path.basename(materialPath, '.mat'),
          path: materialPath,
          guid: materialGuid,
          shader: shaderInfo,
          properties: {
            textures,
            colors,
            floats,
          },
          blendMode: {
            srcBlend,
            dstBlend,
            zWrite,
          },
        };
      } catch {
        // YAML 파싱 실패 무시
      }
    }
  } catch (error) {
    console.error('Material 정보 추출 실패:', error);
  }

  return null;
}

/**
 * Prefab에서 사용하는 모든 Material 정보 추출
 */
export async function resolveMaterialsFromPrefab(
  prefabPath: string,
  assetsRoot: string
): Promise<MaterialInfo[]> {
  const materials: MaterialInfo[] = [];
  const processedGuids = new Set<string>();

  try {
    const prefabContent = await fs.readFile(prefabPath, 'utf-8');

    // Prefab에서 모든 GUID 추출
    const guidMatches = prefabContent.matchAll(/guid:\s*([a-f0-9]{32})/g);

    for (const match of guidMatches) {
      const guid = match[1];
      if (processedGuids.has(guid)) continue;
      processedGuids.add(guid);

      // GUID로 에셋 경로 찾기
      const assetPath = await resolveGuidToPath(guid, assetsRoot);
      if (!assetPath) continue;

      // Material 파일인 경우 정보 추출
      if (assetPath.endsWith('.mat')) {
        const materialInfo = await extractMaterialInfo(assetPath, assetsRoot);
        if (materialInfo) {
          materials.push(materialInfo);
        }
      }
    }
  } catch (error) {
    console.error('Material 추출 실패:', error);
  }

  return materials;
}
