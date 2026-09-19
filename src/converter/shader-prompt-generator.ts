import { MaterialInfo } from '../parser/asset-resolver.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * 쉐이더 캐시 정보
 */
export interface ShaderCacheEntry {
  shaderGuid: string;
  shaderPath: string;
  shaderName: string;
  materialPath: string;
  generatedAt: string;
  hash: string; // 쉐이더 파일 내용의 해시
  outputPath: string; // 생성된 .ts 파일 경로
}

export interface ShaderCacheIndex {
  version: string;
  entries: { [shaderGuid: string]: ShaderCacheEntry };
}

/**
 * 쉐이더 프롬프트 생성 결과
 */
export interface ShaderPromptResult {
  prompt: string;
  shaderName: string;
  shaderPath: string;
  materialInfo: MaterialInfo;
  cacheStatus: 'cached' | 'needs_conversion' | 'no_shader';
  cachedMaterialPath?: string; // 캐시된 경우 생성된 .ts 파일 경로
}

const CACHE_DIR = '.shader-cache';
const CACHE_INDEX_FILE = 'index.json';

/**
 * 캐시 디렉토리 경로 반환
 */
function getCacheDir(projectRoot: string): string {
  return path.join(projectRoot, CACHE_DIR);
}

/**
 * 캐시 인덱스 로드
 */
async function loadCacheIndex(projectRoot: string): Promise<ShaderCacheIndex> {
  const indexPath = path.join(getCacheDir(projectRoot), CACHE_INDEX_FILE);
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { version: '1.0', entries: {} };
  }
}

/**
 * 캐시 인덱스 저장
 */
async function saveCacheIndex(projectRoot: string, index: ShaderCacheIndex): Promise<void> {
  const cacheDir = getCacheDir(projectRoot);
  await fs.mkdir(cacheDir, { recursive: true });
  const indexPath = path.join(cacheDir, CACHE_INDEX_FILE);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

/**
 * 파일 내용의 해시 계산
 */
async function computeFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * 쉐이더가 캐시에 있는지 확인
 */
export async function checkShaderCache(
  projectRoot: string,
  shaderGuid: string,
  shaderPath?: string
): Promise<{ cached: boolean; entry?: ShaderCacheEntry; hashChanged?: boolean }> {
  const index = await loadCacheIndex(projectRoot);
  const entry = index.entries[shaderGuid];

  if (!entry) {
    return { cached: false };
  }

  // 캐시된 파일이 실제로 존재하는지 확인
  try {
    await fs.access(entry.outputPath);
  } catch {
    return { cached: false };
  }

  // 쉐이더 파일이 변경되었는지 확인
  if (shaderPath) {
    const currentHash = await computeFileHash(shaderPath);
    if (currentHash && currentHash !== entry.hash) {
      return { cached: false, entry, hashChanged: true };
    }
  }

  return { cached: true, entry };
}

/**
 * 캐시에 쉐이더 변환 결과 저장
 */
export async function saveToCache(
  projectRoot: string,
  shaderGuid: string,
  shaderPath: string,
  shaderName: string,
  materialPath: string,
  generatedCode: string
): Promise<string> {
  const cacheDir = getCacheDir(projectRoot);
  await fs.mkdir(cacheDir, { recursive: true });

  // 파일명 생성 (쉐이더 이름에서 특수문자 제거)
  const safeName = shaderName.replace(/[^a-zA-Z0-9]/g, '_');
  const outputFileName = `${safeName}.ts`;
  const outputPath = path.join(cacheDir, outputFileName);

  // 코드 저장
  await fs.writeFile(outputPath, generatedCode);

  // 인덱스 업데이트
  const index = await loadCacheIndex(projectRoot);
  const hash = await computeFileHash(shaderPath);

  index.entries[shaderGuid] = {
    shaderGuid,
    shaderPath,
    shaderName,
    materialPath,
    generatedAt: new Date().toISOString(),
    hash,
    outputPath,
  };

  await saveCacheIndex(projectRoot, index);

  return outputPath;
}

/**
 * Unity Shader 파일 읽기
 */
async function readShaderFile(shaderPath: string): Promise<string | null> {
  try {
    return await fs.readFile(shaderPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * LLM에게 보낼 쉐이더 변환 프롬프트 생성
 */
export async function generateShaderPrompt(
  materialInfo: MaterialInfo,
  projectRoot: string
): Promise<ShaderPromptResult> {
  const shaderPath = materialInfo.shader.path;
  const shaderGuid = materialInfo.shader.guid;
  const shaderName = materialInfo.shader.name;

  // 쉐이더 파일이 없는 경우
  if (!shaderPath) {
    return {
      prompt: '',
      shaderName: shaderName || 'Unknown',
      shaderPath: '',
      materialInfo,
      cacheStatus: 'no_shader',
    };
  }

  // 캐시 확인
  const cacheResult = await checkShaderCache(projectRoot, shaderGuid, shaderPath);
  if (cacheResult.cached && cacheResult.entry) {
    return {
      prompt: '',
      shaderName,
      shaderPath,
      materialInfo,
      cacheStatus: 'cached',
      cachedMaterialPath: cacheResult.entry.outputPath,
    };
  }

  // 쉐이더 파일 읽기
  const shaderCode = await readShaderFile(shaderPath);
  if (!shaderCode) {
    return {
      prompt: '',
      shaderName,
      shaderPath,
      materialInfo,
      cacheStatus: 'no_shader',
    };
  }

  // 프롬프트 생성 (절대 경로 포함)
  const prompt = buildPrompt(shaderCode, materialInfo, shaderName, projectRoot);

  return {
    prompt,
    shaderName,
    shaderPath,
    materialInfo,
    cacheStatus: 'needs_conversion',
  };
}

/**
 * 프롬프트 문자열 생성
 */
function buildPrompt(shaderCode: string, materialInfo: MaterialInfo, shaderName: string, projectRoot: string): string {
  const safeShaderName = shaderName.replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = path.join(projectRoot, CACHE_DIR, `${safeShaderName}.ts`);

  // Material 속성 JSON 생성
  const materialPropsJson = JSON.stringify({
    textures: materialInfo.properties.textures.map(t => ({
      name: t.name,
      path: t.path || 'unknown',
    })),
    colors: materialInfo.properties.colors,
    floats: materialInfo.properties.floats,
    blendMode: materialInfo.blendMode,
  }, null, 2);

  return `# Unity Shader → Three.js ShaderMaterial 변환 요청

## 목표
아래 Unity ShaderLab 코드를 Three.js의 Material로 변환해주세요.
파티클 시스템(three.quarks)에서 사용할 Material입니다.

## Unity Shader 코드
\`\`\`shaderlab
${shaderCode}
\`\`\`

## Material 속성 (Unity .mat 파일에서 추출)
\`\`\`json
${materialPropsJson}
\`\`\`

## 출력 형식
TypeScript 파일로 출력해주세요. 아래 형식을 정확히 따라주세요:

\`\`\`typescript
import * as THREE from 'three';

/**
 * ${shaderName} Material
 * Unity Shader에서 변환됨
 */

export interface ${safeShaderName}Uniforms {
  // 필요한 uniform 정의
  [key: string]: THREE.IUniform;
}

/**
 * Material 생성 함수
 * @param texture 메인 텍스처
 * @param options 추가 옵션 (색상, 강도 등)
 */
export function create${safeShaderName}Material(
  texture: THREE.Texture,
  options?: {
    color?: THREE.Color;
    opacity?: number;
    // 쉐이더별 추가 옵션
  }
): THREE.Material {
  // 구현
}

// 기본 export
export default create${safeShaderName}Material;
\`\`\`

## 변환 시 주의사항

### 블렌드 모드 변환
- Unity \`Blend SrcAlpha One\` → \`THREE.AdditiveBlending\`
- Unity \`Blend SrcAlpha OneMinusSrcAlpha\` → \`THREE.NormalBlending\`
- Unity \`Blend One One\` → \`THREE.AdditiveBlending\`
- Unity \`Blend One OneMinusSrcAlpha\` → \`THREE.NormalBlending\` (premultiplied)

### 렌더 상태
- Unity \`ZWrite Off\` → \`depthWrite: false\`
- Unity \`Cull Off\` → \`side: THREE.DoubleSide\`
- Unity \`Cull Back\` → \`side: THREE.FrontSide\`

### 파티클 시스템 호환성
- Vertex Color는 three.quarks에서 자동으로 전달됩니다 (\`vColor\`)
- UV 좌표는 \`vUv\`로 전달됩니다
- 복잡한 쉐이더는 \`THREE.ShaderMaterial\`을 사용하고, 간단한 경우 \`THREE.MeshBasicMaterial\` 등을 사용해도 됩니다

### 커스텀 속성
- \`_Intensity\`, \`_Power\` 등 커스텀 float은 uniform으로 전달
- \`_TintColor\` 등 색상은 \`THREE.Color\`로 변환
- HDR 색상 (r, g, b > 1.0)을 지원해야 합니다

## 출력 파일
**파일명:** \`${safeShaderName}.ts\`
**절대 경로:** \`${outputPath}\`

변환이 완료되면 위 절대 경로에 파일을 저장해주세요.

## 추가 컨텍스트
- 이 Material은 three.quarks 파티클 시스템의 \`ParticleSystem\` 생성자에 전달됩니다
- 텍스처 시트 애니메이션이 활성화된 경우 UV 타일링이 적용됩니다
- \`three.quarks\`의 BatchedParticleRenderer가 렌더링을 담당합니다
`;
}

/**
 * 캐시된 모든 쉐이더 목록 반환
 */
export async function listCachedShaders(projectRoot: string): Promise<ShaderCacheEntry[]> {
  const index = await loadCacheIndex(projectRoot);
  return Object.values(index.entries);
}

/**
 * 캐시 클리어
 */
export async function clearShaderCache(projectRoot: string): Promise<void> {
  const cacheDir = getCacheDir(projectRoot);
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
  } catch {
    // 디렉토리가 없으면 무시
  }
}
