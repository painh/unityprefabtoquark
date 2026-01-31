import fs from 'fs/promises';
import path from 'path';
import { parseUnityYaml, UnityParticleSystem, UnityMinMaxCurve, UnityMinMaxGradient } from '../parser/unity-yaml.js';

export interface ConvertOptions {
  prefabPath: string;
  assetsRoot: string;
  outputRoot: string;
  previewOnly?: boolean;
}

export interface ConvertResult {
  success: boolean;
  outputPath?: string;
  quarksJson: QuarksParticleSystemJson;
  copiedAssets: string[];
  errors: string[];
}

// three.quarks JSON 형식
export interface QuarksParticleSystemJson {
  version: string;
  particleSystems: QuarksParticleSystem[];
}

export interface QuarksParticleSystem {
  name: string;
  duration: number;
  looping: boolean;
  startLife: QuarksValue;
  startSpeed: QuarksValue;
  startSize: QuarksValue;
  startColor: QuarksColorValue;
  startRotation: QuarksValue;
  gravityModifier: number;
  maxParticles: number;
  emission: QuarksEmission;
  shape: QuarksShape;
  behaviors: QuarksBehavior[];
  renderMode: string;
  texture?: string;
  blending: string;
  worldSpace: boolean;
  // Texture Sheet Animation
  textureSheetAnimation?: {
    enabled: boolean;
    tilesX: number;
    tilesY: number;
    frameOverTime: QuarksValue;
    startFrame: QuarksValue;
  };
}

export interface QuarksValue {
  type: 'constant' | 'interval' | 'bezier';
  value?: number;
  min?: number;
  max?: number;
  bezierPoints?: number[][];
}

export interface QuarksColorValue {
  type: 'constant' | 'gradient' | 'randomBetweenTwoColors';
  color?: { r: number; g: number; b: number; a: number };
  colorMin?: { r: number; g: number; b: number; a: number };
  colorMax?: { r: number; g: number; b: number; a: number };
  gradient?: QuarksGradientStop[];
}

export interface QuarksGradientStop {
  t: number;
  color: { r: number; g: number; b: number; a: number };
}

export interface QuarksEmission {
  rateOverTime: QuarksValue;
  bursts: QuarksBurst[];
}

export interface QuarksBurst {
  time: number;
  count: QuarksValue;
  cycles: number;
  interval: number;
}

export interface QuarksShape {
  type: 'point' | 'sphere' | 'hemisphere' | 'cone' | 'box' | 'circle' | 'donut';
  radius?: number;
  arc?: number;
  angle?: number;
  thickness?: number;
  scale?: { x: number; y: number; z: number };
}

export interface QuarksBehavior {
  type: string;
  [key: string]: unknown;
}

/**
 * Unity Prefab을 three.quarks JSON으로 변환
 */
export async function convertPrefabToQuarks(options: ConvertOptions): Promise<ConvertResult> {
  const { prefabPath, assetsRoot, outputRoot, previewOnly } = options;
  const errors: string[] = [];
  const copiedAssets: string[] = [];

  try {
    // Prefab 파일 읽기
    const content = await fs.readFile(prefabPath, 'utf-8');
    const parsed = parseUnityYaml(content);

    if (parsed.particleSystems.length === 0) {
      throw new Error('No ParticleSystem found in prefab');
    }

    // 파티클 시스템 변환
    const quarksParticleSystems = parsed.particleSystems.map(ps =>
      convertParticleSystem(ps)
    );

    const quarksJson: QuarksParticleSystemJson = {
      version: '1.0',
      particleSystems: quarksParticleSystems,
    };

    // 미리보기 전용이면 파일 저장 안 함
    if (previewOnly) {
      return {
        success: true,
        quarksJson,
        copiedAssets: [],
        errors,
      };
    }

    // 출력 경로 계산
    const relativePath = path.relative(assetsRoot, prefabPath);
    const outputPath = path.join(
      outputRoot,
      relativePath.replace('.prefab', '.quarks.json')
    );

    // 출력 디렉토리 생성
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // JSON 저장
    await fs.writeFile(outputPath, JSON.stringify(quarksJson, null, 2));

    // TODO: 텍스처 복사 (Material GUID 추적 필요)

    return {
      success: true,
      outputPath,
      quarksJson,
      copiedAssets,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      quarksJson: { version: '1.0', particleSystems: [] },
      copiedAssets: [],
      errors: [String(error)],
    };
  }
}

/**
 * Unity ParticleSystem을 three.quarks 형식으로 변환
 */
function convertParticleSystem(ps: UnityParticleSystem): QuarksParticleSystem {
  const behaviors: QuarksBehavior[] = [];

  // Color Over Lifetime
  console.log('=== ColorOverLifetime 체크 ===');
  console.log('ps.colorOverLifetime.enabled:', ps.colorOverLifetime.enabled);
  console.log('ps.colorOverLifetime.color:', JSON.stringify(ps.colorOverLifetime.color, null, 2));

  if (ps.colorOverLifetime.enabled) {
    const colorValue = convertColorValue(ps.colorOverLifetime.color);
    console.log('변환된 ColorOverLife:', JSON.stringify(colorValue, null, 2));
    behaviors.push({
      type: 'ColorOverLife',
      color: colorValue,
    });
  }

  // Size Over Lifetime
  if (ps.sizeOverLifetime.enabled) {
    behaviors.push({
      type: 'SizeOverLife',
      size: convertValue(ps.sizeOverLifetime.size),
    });
  }

  // Rotation Over Lifetime
  if (ps.rotationOverLifetime.enabled) {
    behaviors.push({
      type: 'RotationOverLife',
      angularVelocity: convertValue(ps.rotationOverLifetime.z),
    });
  }

  // Velocity Over Lifetime → Apply Force (근사치)
  if (ps.velocityOverLifetime.enabled) {
    behaviors.push({
      type: 'ApplyForce',
      direction: {
        x: getConstantValue(ps.velocityOverLifetime.x),
        y: getConstantValue(ps.velocityOverLifetime.y),
        z: getConstantValue(ps.velocityOverLifetime.z),
      },
      magnitude: 1,
    });
  }

  // Gravity
  const gravity = getConstantValue(ps.main.gravityModifier);
  if (gravity !== 0) {
    behaviors.push({
      type: 'ApplyForce',
      direction: { x: 0, y: -1, z: 0 },
      magnitude: gravity * 9.8,
    });
  }

  return {
    name: `ParticleSystem_${ps.fileId}`,
    duration: ps.main.duration,
    looping: ps.main.loop,
    startLife: convertValue(ps.main.startLifetime),
    startSpeed: convertValue(ps.main.startSpeed),
    startSize: convertValue(ps.main.startSize),
    startColor: convertColorValue(ps.main.startColor),
    startRotation: convertValue(ps.main.startRotation),
    gravityModifier: gravity,
    maxParticles: ps.main.maxParticles,
    emission: {
      rateOverTime: convertValue(ps.emission.rateOverTime),
      bursts: ps.emission.bursts.map(b => ({
        time: b.time,
        count: convertValue(b.countCurve),
        cycles: b.cycleCount,
        interval: b.repeatInterval,
      })),
    },
    shape: convertShape(ps.shape),
    behaviors,
    renderMode: 'billboard',
    blending: 'additive',
    worldSpace: ps.main.simulationSpace === 1,
    // Texture Sheet Animation
    textureSheetAnimation: ps.textureSheetAnimation.enabled ? {
      enabled: true,
      tilesX: ps.textureSheetAnimation.tilesX,
      tilesY: ps.textureSheetAnimation.tilesY,
      frameOverTime: convertValue(ps.textureSheetAnimation.frameOverTime),
      startFrame: convertValue(ps.textureSheetAnimation.startFrame),
    } : undefined,
  };
}

/**
 * Unity Shape 모듈을 three.quarks Shape으로 변환
 */
function convertShape(shape: UnityParticleSystem['shape']): QuarksShape {
  if (!shape.enabled) {
    return { type: 'point' };
  }

  // Unity Shape Types:
  // 0: Sphere, 1: Hemisphere, 2: Cone, 3: Box
  // 4: Mesh, 5: MeshRenderer, 6: SkinnedMeshRenderer
  // 7: Circle, 8: Edge
  switch (shape.type) {
    case 0: // Sphere
      return {
        type: 'sphere',
        radius: shape.radius,
      };
    case 1: // Hemisphere
      return {
        type: 'hemisphere',
        radius: shape.radius,
      };
    case 2: // Cone
      return {
        type: 'cone',
        radius: shape.radius,
        angle: shape.angle * (Math.PI / 180), // degree to radian
      };
    case 3: // Box
      return {
        type: 'box',
        scale: shape.scale,
      };
    case 7: // Circle
      return {
        type: 'circle',
        radius: shape.radius,
      };
    default:
      return { type: 'point' };
  }
}

/**
 * Unity MinMaxCurve를 three.quarks Value로 변환
 */
function convertValue(curve: UnityMinMaxCurve): QuarksValue {
  // MinMaxCurve modes:
  // 0: Constant, 1: Curve, 2: TwoCurves, 3: TwoConstants

  // null/undefined 체크하고 기본값 사용
  const constantValue = (curve.constant !== null && curve.constant !== undefined && !isNaN(curve.constant))
    ? curve.constant
    : 1;

  switch (curve.mode) {
    case 0: // Constant
      return {
        type: 'constant',
        value: constantValue,
      };
    case 3: // TwoConstants (Random Between Two Constants)
      return {
        type: 'interval',
        min: curve.constantMin ?? 0,
        max: curve.constantMax ?? constantValue,
      };
    case 1: // Curve
    case 2: // TwoCurves
      // Curve를 Bezier로 변환 (간단한 근사)
      if (curve.curve?.m_Curve && curve.curve.m_Curve.length > 0) {
        const points = curve.curve.m_Curve.map(kf => [kf.time, kf.value]);
        return {
          type: 'bezier',
          bezierPoints: points,
        };
      }
      return {
        type: 'constant',
        value: constantValue,
      };
    default:
      return {
        type: 'constant',
        value: constantValue,
      };
  }
}

/**
 * Unity MinMaxGradient를 three.quarks ColorValue로 변환
 */
function convertColorValue(gradient: UnityMinMaxGradient): QuarksColorValue {
  // MinMaxGradient modes:
  // 0: Color, 1: Gradient, 2: TwoColors, 3: TwoGradients, 4: RandomColor
  switch (gradient.mode) {
    case 0: // Single Color
      return {
        type: 'constant',
        color: gradient.color ?? { r: 1, g: 1, b: 1, a: 1 },
      };
    case 2: // Random Between Two Colors
      return {
        type: 'randomBetweenTwoColors',
        colorMin: gradient.colorMin ?? { r: 0, g: 0, b: 0, a: 1 },
        colorMax: gradient.colorMax ?? { r: 1, g: 1, b: 1, a: 1 },
      };
    case 1: // Gradient
    case 3: // Two Gradients
      // Unity uses maxGradient for the primary gradient
      const grad = gradient.gradient ?? gradient.gradientMax;
      console.log('Gradient 모드, grad 데이터:', JSON.stringify(grad, null, 2));
      if (grad) {
        return {
          type: 'gradient',
          gradient: convertGradient(grad),
        };
      }
      return {
        type: 'constant',
        color: { r: 1, g: 1, b: 1, a: 1 },
      };
    default:
      return {
        type: 'constant',
        color: gradient.color ?? { r: 1, g: 1, b: 1, a: 1 },
      };
  }
}

/**
 * Unity Gradient를 three.quarks Gradient 스톱으로 변환
 */
function convertGradient(gradient: NonNullable<UnityMinMaxGradient['gradient']>): QuarksGradientStop[] {
  const stops: QuarksGradientStop[] = [];
  const keys = [
    { color: gradient.key0, ctime: gradient.ctime0, atime: gradient.atime0 },
    { color: gradient.key1, ctime: gradient.ctime1, atime: gradient.atime1 },
    { color: gradient.key2, ctime: gradient.ctime2, atime: gradient.atime2 },
    { color: gradient.key3, ctime: gradient.ctime3, atime: gradient.atime3 },
    { color: gradient.key4, ctime: gradient.ctime4, atime: gradient.atime4 },
    { color: gradient.key5, ctime: gradient.ctime5, atime: gradient.atime5 },
    { color: gradient.key6, ctime: gradient.ctime6, atime: gradient.atime6 },
    { color: gradient.key7, ctime: gradient.ctime7, atime: gradient.atime7 },
  ];

  const numColorKeys = gradient.m_NumColorKeys;
  const numAlphaKeys = gradient.m_NumAlphaKeys;

  // Color keys (ctime은 0-65535 범위)
  for (let i = 0; i < numColorKeys; i++) {
    const key = keys[i];
    stops.push({
      t: key.ctime / 65535,
      color: {
        r: key.color.r,
        g: key.color.g,
        b: key.color.b,
        a: key.color.a,
      },
    });
  }

  // 시간순 정렬
  stops.sort((a, b) => a.t - b.t);

  return stops;
}

/**
 * MinMaxCurve에서 상수 값 추출
 */
function getConstantValue(curve: UnityMinMaxCurve): number {
  if (curve.mode === 0) {
    return curve.constant ?? 0;
  }
  if (curve.mode === 3) {
    return ((curve.constantMin ?? 0) + (curve.constantMax ?? 0)) / 2;
  }
  return curve.constant ?? 0;
}
