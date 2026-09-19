import fs from 'fs/promises';
import path from 'path';
import { parseUnityYaml, UnityParticleSystem, UnityMinMaxCurve, UnityMinMaxGradient, UnityParticleSystemRenderer } from '../parser/unity-yaml.js';

export interface ConvertOptions {
  prefabPath: string;
  assetsRoot: string;
  outputRoot: string;
  previewOnly?: boolean;
}

// 변환 상세 정보
export interface ConversionDetail {
  module: string;
  unity: string;  // Unity 원본 값
  quarks: string; // 변환된 값
  status: 'ok' | 'partial' | 'unsupported';
  note?: string;
}

export interface ParticleSystemConversionInfo {
  name: string;
  details: ConversionDetail[];
}

export interface ConvertResult {
  success: boolean;
  outputPath?: string;
  quarksJson: QuarksParticleSystemJson;
  copiedAssets: string[];
  errors: string[];
  warnings: string[]; // 변환 경고 (미지원 기능 등)
  conversionInfo: ParticleSystemConversionInfo[];
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
  startDelay?: number;
  startLife: QuarksValue;
  startSpeed: QuarksValue;
  startSize: QuarksValue;
  startSize3D?: { x: QuarksValue; y: QuarksValue; z: QuarksValue };
  startColor: QuarksColorValue;
  startRotation: QuarksValue;
  startRotation3D?: { x: QuarksValue; y: QuarksValue };
  gravityModifier: number;
  maxParticles: number;
  emission: QuarksEmission;
  shape: QuarksShape;
  behaviors: QuarksBehavior[];
  renderMode: number; // 0: Billboard, 1: StretchedBillBoard, 2: Mesh, 3: Trail, 4: HorizontalBillBoard, 5: VerticalBillBoard
  rendererSettings?: {
    lengthScale?: number;
    velocityScale?: number;
  };
  // Trail 설정
  trail?: {
    enabled: boolean;
    startLength: QuarksValue;
    followLocalOrigin: boolean;
  };
  texture?: string;
  blending: string;
  worldSpace: boolean;
  speedFactor?: number;
  // Texture Sheet Animation
  textureSheetAnimation?: {
    enabled: boolean;
    tilesX: number;
    tilesY: number;
    animationType: number;
    rowIndex: number;
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
  rateOverDistance?: QuarksValue;
  bursts: QuarksBurst[];
}

export interface QuarksBurst {
  time: number;
  count: QuarksValue;
  cycles: number;
  interval: number;
  probability: number;
}

export interface QuarksShape {
  type: 'point' | 'sphere' | 'hemisphere' | 'cone' | 'box' | 'circle' | 'donut' | 'edge';
  radius?: number;
  arc?: number;
  angle?: number;
  thickness?: number; // 0 = surface only, 1 = full volume
  donutRadius?: number; // Donut shape의 내부 반지름
  spread?: number; // 방향 랜덤화 (Unity randomDirectionAmount)
  scale?: { x: number; y: number; z: number };
  // Shape rotation (Euler angles in degrees)
  rotation?: { x: number; y: number; z: number };
  // Shape position offset
  position?: { x: number; y: number; z: number };
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
  const warnings: string[] = [];
  const copiedAssets: string[] = [];
  const conversionInfo: ParticleSystemConversionInfo[] = [];

  try {
    // Prefab 파일 읽기
    const content = await fs.readFile(prefabPath, 'utf-8');
    const parsed = parseUnityYaml(content);

    if (parsed.particleSystems.length === 0) {
      throw new Error('No ParticleSystem found in prefab');
    }

    // 파티클 시스템 변환 (renderer 정보 포함)
    const quarksParticleSystems = parsed.particleSystems.map((ps, index) => {
      // 해당 파티클 시스템의 renderer 정보 찾기
      const renderer = parsed.particleSystemRenderers.get(ps.gameObject.fileID);
      const { system, info, warnings: psWarnings } = convertParticleSystemWithInfo(ps, index, renderer);
      conversionInfo.push(info);
      warnings.push(...psWarnings);
      return system;
    });

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
        warnings,
        conversionInfo,
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
      warnings,
      conversionInfo,
    };
  } catch (error) {
    return {
      success: false,
      quarksJson: { version: '1.0', particleSystems: [] },
      copiedAssets: [],
      errors: [String(error)],
      warnings,
      conversionInfo,
    };
  }
}

// Unity Shape Type 이름
const UNITY_SHAPE_NAMES: Record<number, string> = {
  0: 'Sphere',
  1: 'Hemisphere',
  2: 'Cone',
  3: 'Box',
  4: 'Mesh',
  5: 'MeshRenderer',
  6: 'SkinnedMeshRenderer',
  7: 'Circle',
  8: 'Edge',
  12: 'Donut',
};

function formatValue(v: QuarksValue): string {
  if (v.type === 'constant') return `${v.value?.toFixed(2)}`;
  if (v.type === 'interval') return `${v.min?.toFixed(2)}~${v.max?.toFixed(2)}`;
  if (v.type === 'bezier') return `Curve(${v.bezierPoints?.length} points)`;
  return 'unknown';
}

function formatColor(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${c.r.toFixed(2)}, ${c.g.toFixed(2)}, ${c.b.toFixed(2)}, ${c.a.toFixed(2)})`;
}

/**
 * Unity ParticleSystem을 three.quarks 형식으로 변환 (상세 정보 포함)
 */
function convertParticleSystemWithInfo(ps: UnityParticleSystem, index: number, renderer?: UnityParticleSystemRenderer): { system: QuarksParticleSystem; info: ParticleSystemConversionInfo; warnings: string[] } {
  const details: ConversionDetail[] = [];
  const behaviors: QuarksBehavior[] = [];
  const warnings: string[] = [];

  // === Main Module ===
  const startLife = convertValue(ps.main.startLifetime);
  details.push({
    module: 'StartLifetime',
    unity: `mode=${ps.main.startLifetime.mode}, value=${ps.main.startLifetime.constant?.toFixed(2) ?? 'curve'}`,
    quarks: formatValue(startLife),
    status: 'ok',
  });

  const startSpeed = convertValue(ps.main.startSpeed);
  details.push({
    module: 'StartSpeed',
    unity: `mode=${ps.main.startSpeed.mode}, value=${ps.main.startSpeed.constant?.toFixed(2) ?? 'curve'}`,
    quarks: formatValue(startSpeed),
    status: 'ok',
  });

  const startSize = convertValue(ps.main.startSize);
  const startSize3D = ps.main.startSize3D ? {
    x: convertValue(ps.main.startSizeX),
    y: convertValue(ps.main.startSizeY),
    z: convertValue(ps.main.startSizeZ),
  } : undefined;

  if (ps.main.startSize3D) {
    details.push({
      module: 'StartSize3D',
      unity: `X=${ps.main.startSizeX.constant?.toFixed(2) ?? 'curve'}, Y=${ps.main.startSizeY.constant?.toFixed(2) ?? 'curve'}, Z=${ps.main.startSizeZ.constant?.toFixed(2) ?? 'curve'}`,
      quarks: 'Vector3Function',
      status: 'ok',
    });
  } else {
    details.push({
      module: 'StartSize',
      unity: `mode=${ps.main.startSize.mode}, value=${ps.main.startSize.constant?.toFixed(2) ?? 'curve'}`,
      quarks: formatValue(startSize),
      status: 'ok',
    });
  }

  const startColor = convertColorValue(ps.main.startColor);
  details.push({
    module: 'StartColor',
    unity: `mode=${ps.main.startColor.mode}, color=${ps.main.startColor.color ? formatColor(ps.main.startColor.color) : 'gradient'}`,
    quarks: startColor.color ? formatColor(startColor.color) : `${startColor.type}`,
    status: 'ok',
  });

  const startRotation = convertValue(ps.main.startRotation);
  const startRotation3D = ps.main.startRotation3D ? {
    x: convertValue(ps.main.startRotationX),
    y: convertValue(ps.main.startRotationY),
  } : undefined;

  if (ps.main.startRotation3D) {
    details.push({
      module: 'StartRotation3D',
      unity: `X=${ps.main.startRotationX.constant?.toFixed(2) ?? 'curve'}, Y=${ps.main.startRotationY.constant?.toFixed(2) ?? 'curve'}, Z=${ps.main.startRotation.constant?.toFixed(2) ?? 'curve'}`,
      quarks: 'EulerGenerator',
      status: 'ok',
    });
  } else {
    details.push({
      module: 'StartRotation',
      unity: `mode=${ps.main.startRotation.mode}, value=${ps.main.startRotation.constant?.toFixed(2) ?? 'curve'}`,
      quarks: formatValue(startRotation),
      status: 'ok',
    });
  }

  // StartDelay
  const startDelay = getConstantValue(ps.main.startDelay);
  if (startDelay > 0) {
    details.push({
      module: 'StartDelay',
      unity: `${startDelay.toFixed(2)}s`,
      quarks: `${startDelay.toFixed(2)}s (클라이언트 처리)`,
      status: 'ok',
    });
  }

  // SimulationSpace
  details.push({
    module: 'SimulationSpace',
    unity: ps.main.simulationSpace === 0 ? 'Local' : 'World',
    quarks: ps.main.simulationSpace === 1 ? 'World' : 'Local',
    status: 'ok',
  });

  // === Emission ===
  const rateOverTime = convertValue(ps.emission.rateOverTime);
  details.push({
    module: 'Emission.RateOverTime',
    unity: `mode=${ps.emission.rateOverTime.mode}, value=${ps.emission.rateOverTime.constant?.toFixed(2) ?? 'curve'}`,
    quarks: formatValue(rateOverTime),
    status: ps.emission.enabled ? 'ok' : 'partial',
    note: !ps.emission.enabled ? 'Emission disabled' : undefined,
  });

  const rateOverDistance = convertValue(ps.emission.rateOverDistance);
  const hasRateOverDistance = getConstantValue(ps.emission.rateOverDistance) > 0;
  if (hasRateOverDistance) {
    details.push({
      module: 'Emission.RateOverDistance',
      unity: `mode=${ps.emission.rateOverDistance.mode}, value=${ps.emission.rateOverDistance.constant?.toFixed(2) ?? 'curve'}`,
      quarks: formatValue(rateOverDistance),
      status: 'ok',
    });
  }

  if (ps.emission.bursts.length > 0) {
    details.push({
      module: 'Emission.Bursts',
      unity: `${ps.emission.bursts.length} bursts`,
      quarks: `${ps.emission.bursts.length} bursts`,
      status: 'ok',
    });
  }

  // === Shape ===
  const shapeTypeName = UNITY_SHAPE_NAMES[ps.shape.type] || `Unknown(${ps.shape.type})`;
  const shapeResult = convertShape(ps.shape);
  const isShapeSupported = ['sphere', 'hemisphere', 'cone', 'box', 'circle', 'point'].includes(shapeResult.type);

  details.push({
    module: 'Shape.Type',
    unity: `${shapeTypeName} (${ps.shape.type})`,
    quarks: shapeResult.type,
    status: isShapeSupported ? 'ok' : 'unsupported',
    note: !isShapeSupported ? `${shapeTypeName}은 지원되지 않음 → Point로 대체` : undefined,
  });

  if (ps.shape.enabled) {
    details.push({
      module: 'Shape.Radius',
      unity: `${ps.shape.radius.toFixed(2)}`,
      quarks: `${shapeResult.radius?.toFixed(2) ?? 'N/A'}`,
      status: 'ok',
    });

    // RadiusThickness 표시 (Sphere, Hemisphere, Cone, Circle에서 사용)
    if ([0, 1, 2, 7].includes(ps.shape.type)) {
      details.push({
        module: 'Shape.Thickness',
        unity: `${ps.shape.radiusThickness.toFixed(2)} (${ps.shape.radiusThickness === 0 ? 'Surface' : ps.shape.radiusThickness === 1 ? 'Volume' : 'Mixed'})`,
        quarks: `${shapeResult.thickness?.toFixed(2) ?? 'N/A'}`,
        status: 'ok',
      });
    }

    if (ps.shape.type === 2) { // Cone
      details.push({
        module: 'Shape.Angle',
        unity: `${ps.shape.angle.toFixed(1)}°`,
        quarks: `${((shapeResult.angle ?? 0) * 180 / Math.PI).toFixed(1)}° (rad: ${shapeResult.angle?.toFixed(2)})`,
        status: 'ok',
      });
    }

    // RandomDirectionAmount -> spread
    if (ps.shape.randomDirectionAmount > 0) {
      details.push({
        module: 'Shape.RandomDirection',
        unity: `${ps.shape.randomDirectionAmount.toFixed(2)}`,
        quarks: `spread: ${ps.shape.randomDirectionAmount.toFixed(2)}`,
        status: 'ok',
      });
    }

    // SphericalDirectionAmount - 지원 안됨
    if (ps.shape.sphericalDirectionAmount > 0) {
      details.push({
        module: 'Shape.SphericalDirection',
        unity: `${ps.shape.sphericalDirectionAmount.toFixed(2)}`,
        quarks: '미지원',
        status: 'unsupported',
        note: 'three.quarks는 SphericalDirectionAmount 미지원',
      });
    }

    // Position offset
    if (ps.shape.position.x !== 0 || ps.shape.position.y !== 0 || ps.shape.position.z !== 0) {
      details.push({
        module: 'Shape.Position',
        unity: `(${ps.shape.position.x.toFixed(2)}, ${ps.shape.position.y.toFixed(2)}, ${ps.shape.position.z.toFixed(2)})`,
        quarks: 'emitter.position',
        status: 'ok',
      });
    }

    if (ps.shape.rotation.x !== 0 || ps.shape.rotation.y !== 0 || ps.shape.rotation.z !== 0) {
      details.push({
        module: 'Shape.Rotation',
        unity: `(${ps.shape.rotation.x.toFixed(1)}°, ${ps.shape.rotation.y.toFixed(1)}°, ${ps.shape.rotation.z.toFixed(1)}°)`,
        quarks: `Emitter rotation (${ps.shape.rotation.x.toFixed(1)}°, ${ps.shape.rotation.y.toFixed(1)}°, ${ps.shape.rotation.z.toFixed(1)}°)`,
        status: 'ok',
        note: 'Emitter Object3D에 회전 적용',
      });
    }
  }

  // === Color Over Lifetime ===
  if (ps.colorOverLifetime.enabled) {
    const colorValue = convertColorValue(ps.colorOverLifetime.color);
    behaviors.push({
      type: 'ColorOverLife',
      color: colorValue,
    });
    details.push({
      module: 'ColorOverLifetime',
      unity: `mode=${ps.colorOverLifetime.color.mode}`,
      quarks: colorValue.type,
      status: 'ok',
    });
  }

  // === Size Over Lifetime ===
  if (ps.sizeOverLifetime.enabled) {
    if (ps.sizeOverLifetime.separateAxes) {
      // Separate Axes 모드 - Vector3Function 사용
      behaviors.push({
        type: 'SizeOverLife',
        separateAxes: true,
        x: convertValue(ps.sizeOverLifetime.x),
        y: convertValue(ps.sizeOverLifetime.y),
        z: convertValue(ps.sizeOverLifetime.z),
      });
      details.push({
        module: 'SizeOverLifetime.SeparateAxes',
        unity: 'X/Y/Z 축별 커브',
        quarks: 'Vector3Function',
        status: 'ok',
      });
    } else {
      behaviors.push({
        type: 'SizeOverLife',
        size: convertValue(ps.sizeOverLifetime.size),
      });
      details.push({
        module: 'SizeOverLifetime',
        unity: `mode=${ps.sizeOverLifetime.size.mode}`,
        quarks: 'SizeOverLife behavior',
        status: 'ok',
      });
    }
  }

  // === Rotation Over Lifetime ===
  if (ps.rotationOverLifetime.enabled) {
    behaviors.push({
      type: 'RotationOverLife',
      angularVelocity: convertValue(ps.rotationOverLifetime.z),
    });
    details.push({
      module: 'RotationOverLifetime',
      unity: `z=${ps.rotationOverLifetime.z.constant?.toFixed(2) ?? 'curve'}`,
      quarks: 'RotationOverLife behavior',
      status: 'ok',
    });
  }

  // === Velocity Over Lifetime ===
  if (ps.velocityOverLifetime.enabled) {
    const vx = getConstantValue(ps.velocityOverLifetime.x);
    const vy = getConstantValue(ps.velocityOverLifetime.y);
    const vz = getConstantValue(ps.velocityOverLifetime.z);
    const velocitySpace = ps.velocityOverLifetime.space === 1 ? 'World' : 'Local';
    behaviors.push({
      type: 'ApplyForce',
      direction: { x: vx, y: vy, z: vz },
      magnitude: 1,
    });
    details.push({
      module: 'VelocityOverLifetime',
      unity: `(${vx.toFixed(2)}, ${vy.toFixed(2)}, ${vz.toFixed(2)}) [${velocitySpace}]`,
      quarks: 'ApplyForce (근사)',
      status: 'partial',
      note: `Space=${velocitySpace}, VelocityOverLifetime → ApplyForce로 근사 변환`,
    });
  }

  // === Gravity ===
  const gravity = getConstantValue(ps.main.gravityModifier);
  if (gravity !== 0) {
    behaviors.push({
      type: 'ApplyForce',
      direction: { x: 0, y: -1, z: 0 },
      magnitude: gravity * 9.8,
    });
    details.push({
      module: 'GravityModifier',
      unity: `${gravity.toFixed(2)}`,
      quarks: `ApplyForce(0, -${(gravity * 9.8).toFixed(2)}, 0)`,
      status: 'ok',
    });
  }

  // === Force Over Lifetime ===
  if (ps.forceOverLifetime.enabled) {
    const fx = getConstantValue(ps.forceOverLifetime.x);
    const fy = getConstantValue(ps.forceOverLifetime.y);
    const fz = getConstantValue(ps.forceOverLifetime.z);
    const forceSpace = ps.forceOverLifetime.space === 1 ? 'World' : 'Local';

    // 힘의 크기 계산
    const forceMagnitude = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (forceMagnitude > 0) {
      behaviors.push({
        type: 'ApplyForce',
        direction: { x: fx / forceMagnitude, y: fy / forceMagnitude, z: fz / forceMagnitude },
        magnitude: forceMagnitude,
      });
      details.push({
        module: 'ForceOverLifetime',
        unity: `(${fx.toFixed(2)}, ${fy.toFixed(2)}, ${fz.toFixed(2)}) [${forceSpace}]`,
        quarks: `ApplyForce(magnitude=${forceMagnitude.toFixed(2)})`,
        status: 'ok',
      });
    }
  }

  // === Noise Module ===
  if (ps.noise.enabled) {
    const noiseStrength = getConstantValue(ps.noise.strength);
    const noiseFrequency = ps.noise.frequency;
    const positionAmount = getConstantValue(ps.noise.positionAmount);
    const rotationAmount = getConstantValue(ps.noise.rotationAmount);

    behaviors.push({
      type: 'Noise',
      frequency: noiseFrequency,
      power: noiseStrength,
      positionAmount: positionAmount,
      rotationAmount: rotationAmount,
    });
    details.push({
      module: 'NoiseModule',
      unity: `strength=${noiseStrength.toFixed(2)}, freq=${noiseFrequency.toFixed(2)}`,
      quarks: `Noise(freq=${noiseFrequency.toFixed(2)}, power=${noiseStrength.toFixed(2)})`,
      status: 'ok',
    });
  }

  // === Texture Sheet Animation ===
  if (ps.textureSheetAnimation.enabled) {
    details.push({
      module: 'TextureSheetAnimation',
      unity: `${ps.textureSheetAnimation.tilesX}x${ps.textureSheetAnimation.tilesY}`,
      quarks: `${ps.textureSheetAnimation.tilesX}x${ps.textureSheetAnimation.tilesY}`,
      status: 'ok',
    });
  }

  // === Trail Module ===
  let trailSettings: { enabled: boolean; startLength: QuarksValue; followLocalOrigin: boolean } | undefined;
  if (ps.trail.enabled) {
    // Unity Trail lifetime을 three.quarks startLength로 변환
    // Unity의 lifetime은 시간 기반, three.quarks는 길이 기반
    // lifetime * startSpeed를 길이로 근사
    const trailLifetime = getConstantValue(ps.trail.lifetime);
    const startSpeedValue = getConstantValue(ps.main.startSpeed);
    const estimatedLength = trailLifetime * startSpeedValue;

    trailSettings = {
      enabled: true,
      startLength: { type: 'constant', value: Math.max(0.1, estimatedLength) },
      followLocalOrigin: !ps.trail.worldSpace, // worldSpace의 반대
    };

    details.push({
      module: 'TrailModule',
      unity: `lifetime=${trailLifetime.toFixed(2)}, ratio=${ps.trail.ratio.toFixed(2)}, worldSpace=${ps.trail.worldSpace}`,
      quarks: `startLength=${estimatedLength.toFixed(2)}, followLocalOrigin=${trailSettings.followLocalOrigin}`,
      status: 'ok',
    });
  }

  // Unity renderMode -> three.quarks RenderMode 변환
  // Unity: 0=Billboard, 1=Stretch, 2=HorizontalBillboard, 3=VerticalBillboard, 4=Mesh
  // three.quarks: 0=BillBoard, 1=StretchedBillBoard, 2=Mesh, 3=Trail, 4=HorizontalBillBoard, 5=VerticalBillBoard
  let quarksRenderMode = 0; // 기본: Billboard
  let rendererSettings: { lengthScale?: number; velocityScale?: number } | undefined;

  // Trail 모듈이 활성화되면 RenderMode를 Trail(3)로 설정
  if (ps.trail.enabled) {
    quarksRenderMode = 3; // Trail
    details.push({
      module: 'Renderer.RenderMode',
      unity: 'Trail Module enabled',
      quarks: 'Trail',
      status: 'ok',
    });
  } else if (renderer) {
    switch (renderer.renderMode) {
      case 0: // Unity Billboard
        quarksRenderMode = 0;
        break;
      case 1: // Unity Stretch -> three.quarks StretchedBillBoard
        quarksRenderMode = 1;
        rendererSettings = {
          lengthScale: renderer.lengthScale,
          velocityScale: renderer.velocityScale,
        };
        break;
      case 2: // Unity HorizontalBillboard
        quarksRenderMode = 4;
        break;
      case 3: // Unity VerticalBillboard
        quarksRenderMode = 5;
        break;
      case 4: // Unity Mesh
        quarksRenderMode = 2;
        break;
    }

    const renderModeNames = ['Billboard', 'Stretch', 'HorizontalBillboard', 'VerticalBillboard', 'Mesh'];
    const quarksRenderModeNames = ['BillBoard', 'StretchedBillBoard', 'Mesh', 'Trail', 'HorizontalBillBoard', 'VerticalBillBoard'];
    details.push({
      module: 'Renderer.RenderMode',
      unity: renderModeNames[renderer.renderMode] || `Unknown(${renderer.renderMode})`,
      quarks: quarksRenderModeNames[quarksRenderMode],
      status: 'ok',
    });

    if (renderer.renderMode === 1) {
      details.push({
        module: 'Renderer.StretchSettings',
        unity: `lengthScale=${renderer.lengthScale}, velocityScale=${renderer.velocityScale}`,
        quarks: `lengthFactor=${renderer.lengthScale}, speedFactor=${renderer.velocityScale}`,
        status: 'ok',
      });
    }
  }

  const system: QuarksParticleSystem = {
    name: `ParticleSystem_${index}`,
    duration: ps.main.duration,
    looping: ps.main.loop,
    startDelay: startDelay > 0 ? startDelay : undefined,
    startLife,
    startSpeed,
    startSize,
    startSize3D,
    startColor,
    startRotation,
    startRotation3D,
    gravityModifier: gravity,
    maxParticles: ps.main.maxParticles,
    emission: {
      rateOverTime,
      rateOverDistance: hasRateOverDistance ? rateOverDistance : undefined,
      bursts: ps.emission.bursts.map(b => ({
        time: b.time,
        count: convertValue(b.countCurve),
        cycles: b.cycleCount,
        interval: b.repeatInterval,
        probability: b.probability,
      })),
    },
    shape: shapeResult,
    behaviors,
    renderMode: quarksRenderMode,
    rendererSettings,
    trail: trailSettings,
    blending: 'additive',
    worldSpace: ps.main.simulationSpace === 1,
    speedFactor: ps.main.simulationSpeed !== 1 ? ps.main.simulationSpeed : undefined,
    textureSheetAnimation: ps.textureSheetAnimation.enabled ? {
      enabled: true,
      tilesX: ps.textureSheetAnimation.tilesX,
      tilesY: ps.textureSheetAnimation.tilesY,
      animationType: ps.textureSheetAnimation.animationType, // 0: WholeSheet, 1: SingleRow
      rowIndex: ps.textureSheetAnimation.rowIndex,
      frameOverTime: convertValue(ps.textureSheetAnimation.frameOverTime),
      startFrame: convertValue(ps.textureSheetAnimation.startFrame),
    } : undefined,
  };

  // 미지원/부분 지원 항목들을 warnings에 추가
  for (const detail of details) {
    if (detail.status === 'unsupported') {
      warnings.push(`[PS#${index + 1}] ${detail.module}: ${detail.unity} → 미지원${detail.note ? ` (${detail.note})` : ''}`);
    } else if (detail.status === 'partial') {
      warnings.push(`[PS#${index + 1}] ${detail.module}: ${detail.unity} → 부분 지원${detail.note ? ` (${detail.note})` : ''}`);
    }
  }

  return {
    system,
    info: {
      name: `ParticleSystem #${index + 1}`,
      details,
    },
    warnings,
  };
}

/**
 * Unity Shape 모듈을 three.quarks Shape으로 변환
 */
function convertShape(shape: UnityParticleSystem['shape']): QuarksShape {
  if (!shape.enabled) {
    return { type: 'point' };
  }

  // Shape rotation (Unity는 degree 단위)
  const hasRotation = shape.rotation.x !== 0 || shape.rotation.y !== 0 || shape.rotation.z !== 0;
  const rotation = hasRotation ? {
    x: shape.rotation.x,
    y: shape.rotation.y,
    z: shape.rotation.z,
  } : undefined;

  // Shape position offset
  const hasPosition = shape.position.x !== 0 || shape.position.y !== 0 || shape.position.z !== 0;
  const position = hasPosition ? {
    x: shape.position.x,
    y: shape.position.y,
    z: shape.position.z,
  } : undefined;

  // Unity radiusThickness를 three.quarks thickness로 변환
  // Unity: 0 = surface, 1 = volume
  // three.quarks: 0 = full volume, 1 = surface only (반대!)
  const thickness = shape.radiusThickness;

  // Unity randomDirectionAmount -> three.quarks spread
  const spread = shape.randomDirectionAmount > 0 ? shape.randomDirectionAmount : undefined;

  // Unity Shape Types:
  // 0: Sphere, 1: Hemisphere, 2: Cone, 3: Box
  // 4: Mesh, 5: MeshRenderer, 6: SkinnedMeshRenderer
  // 7: Circle, 8: Edge
  switch (shape.type) {
    case 0: // Sphere
      return {
        type: 'sphere',
        radius: shape.radius,
        thickness,
        spread,
        rotation,
        position,
      };
    case 1: // Hemisphere
      return {
        type: 'hemisphere',
        radius: shape.radius,
        thickness,
        spread,
        rotation,
        position,
      };
    case 2: // Cone
      return {
        type: 'cone',
        radius: shape.radius,
        angle: shape.angle * (Math.PI / 180), // degree to radian
        arc: shape.arc * (Math.PI / 180), // degree to radian
        thickness,
        spread,
        rotation,
        position,
      };
    case 3: // Box
      return {
        type: 'box',
        scale: shape.scale,
        spread,
        rotation,
        position,
      };
    case 7: // Circle
      return {
        type: 'circle',
        radius: shape.radius,
        thickness,
        spread,
        rotation,
        position,
      };
    case 8: // Edge
      return {
        type: 'edge',
        radius: shape.radius, // Edge에서 radius는 반쪽 길이
        spread,
        rotation,
        position,
      };
    case 12: // Donut
      return {
        type: 'donut',
        radius: shape.radius,
        donutRadius: shape.donutRadius,
        arc: shape.arc * (Math.PI / 180), // degree to radian
        thickness,
        spread,
        rotation,
        position,
      };
    default:
      return { type: 'point', rotation, position };
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
 *
 * Unity에서 Color와 Alpha는 별도의 키로 관리됨:
 * - Color keys: key0~key7의 RGB + ctime0~ctime7
 * - Alpha keys: key0~key7의 A + atime0~atime7
 *
 * 이를 합쳐서 하나의 Gradient로 만들어야 함
 */
function convertGradient(gradient: NonNullable<UnityMinMaxGradient['gradient']>): QuarksGradientStop[] {
  const numColorKeys = gradient.m_NumColorKeys;
  const numAlphaKeys = gradient.m_NumAlphaKeys;

  // Color key 배열
  const colorKeys = [
    { color: gradient.key0, time: gradient.ctime0 / 65535 },
    { color: gradient.key1, time: gradient.ctime1 / 65535 },
    { color: gradient.key2, time: gradient.ctime2 / 65535 },
    { color: gradient.key3, time: gradient.ctime3 / 65535 },
    { color: gradient.key4, time: gradient.ctime4 / 65535 },
    { color: gradient.key5, time: gradient.ctime5 / 65535 },
    { color: gradient.key6, time: gradient.ctime6 / 65535 },
    { color: gradient.key7, time: gradient.ctime7 / 65535 },
  ].slice(0, numColorKeys);

  // Alpha key 배열 (key의 a 값 사용)
  const alphaKeys = [
    { alpha: gradient.key0.a, time: gradient.atime0 / 65535 },
    { alpha: gradient.key1.a, time: gradient.atime1 / 65535 },
    { alpha: gradient.key2.a, time: gradient.atime2 / 65535 },
    { alpha: gradient.key3.a, time: gradient.atime3 / 65535 },
    { alpha: gradient.key4.a, time: gradient.atime4 / 65535 },
    { alpha: gradient.key5.a, time: gradient.atime5 / 65535 },
    { alpha: gradient.key6.a, time: gradient.atime6 / 65535 },
    { alpha: gradient.key7.a, time: gradient.atime7 / 65535 },
  ].slice(0, numAlphaKeys);

  // 모든 시간 포인트 수집 (중복 제거)
  const allTimes = new Set<number>();
  colorKeys.forEach(k => allTimes.add(k.time));
  alphaKeys.forEach(k => allTimes.add(k.time));

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  // 특정 시간에서 색상 보간
  function interpolateColor(t: number): { r: number; g: number; b: number } {
    if (colorKeys.length === 0) return { r: 1, g: 1, b: 1 };
    if (colorKeys.length === 1) return { r: colorKeys[0].color.r, g: colorKeys[0].color.g, b: colorKeys[0].color.b };

    // t 이전/이후 키 찾기
    let prevKey = colorKeys[0];
    let nextKey = colorKeys[colorKeys.length - 1];

    for (let i = 0; i < colorKeys.length - 1; i++) {
      if (t >= colorKeys[i].time && t <= colorKeys[i + 1].time) {
        prevKey = colorKeys[i];
        nextKey = colorKeys[i + 1];
        break;
      }
    }

    // t가 범위 밖이면 클램프
    if (t <= prevKey.time) return { r: prevKey.color.r, g: prevKey.color.g, b: prevKey.color.b };
    if (t >= nextKey.time) return { r: nextKey.color.r, g: nextKey.color.g, b: nextKey.color.b };

    // 선형 보간
    const ratio = (t - prevKey.time) / (nextKey.time - prevKey.time);
    return {
      r: prevKey.color.r + (nextKey.color.r - prevKey.color.r) * ratio,
      g: prevKey.color.g + (nextKey.color.g - prevKey.color.g) * ratio,
      b: prevKey.color.b + (nextKey.color.b - prevKey.color.b) * ratio,
    };
  }

  // 특정 시간에서 알파 보간
  function interpolateAlpha(t: number): number {
    if (alphaKeys.length === 0) return 1;
    if (alphaKeys.length === 1) return alphaKeys[0].alpha;

    let prevKey = alphaKeys[0];
    let nextKey = alphaKeys[alphaKeys.length - 1];

    for (let i = 0; i < alphaKeys.length - 1; i++) {
      if (t >= alphaKeys[i].time && t <= alphaKeys[i + 1].time) {
        prevKey = alphaKeys[i];
        nextKey = alphaKeys[i + 1];
        break;
      }
    }

    if (t <= prevKey.time) return prevKey.alpha;
    if (t >= nextKey.time) return nextKey.alpha;

    const ratio = (t - prevKey.time) / (nextKey.time - prevKey.time);
    return prevKey.alpha + (nextKey.alpha - prevKey.alpha) * ratio;
  }

  // 최종 gradient stops 생성
  const stops: QuarksGradientStop[] = sortedTimes.map(t => {
    const rgb = interpolateColor(t);
    const a = interpolateAlpha(t);
    return {
      t,
      color: { r: rgb.r, g: rgb.g, b: rgb.b, a },
    };
  });

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
