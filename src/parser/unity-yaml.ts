import YAML from 'yaml';

// Unity YAML의 특수 태그 타입 정의
export interface UnityObject {
  classId: number;
  fileId: number;
  data: Record<string, unknown>;
}

export interface UnityDocument {
  objects: UnityObject[];
  gameObjects: UnityGameObject[];
  particleSystems: UnityParticleSystem[];
  particleSystemRenderers: Map<number, UnityParticleSystemRenderer>; // gameObject fileID -> renderer
}

export interface UnityGameObject {
  fileId: number;
  name: string;
  components: { fileID: number }[];
  children: number[]; // Transform fileID
}

export interface UnityTransform {
  fileId: number;
  gameObject: { fileID: number };
  localPosition: { x: number; y: number; z: number };
  localRotation: { x: number; y: number; z: number; w: number };
  localScale: { x: number; y: number; z: number };
  children: { fileID: number }[];
  father: { fileID: number };
}

export interface UnityParticleSystem {
  fileId: number;
  gameObject: { fileID: number };
  // Main Module
  main: {
    duration: number;
    loop: boolean;
    startDelay: UnityMinMaxCurve;
    startLifetime: UnityMinMaxCurve;
    startSpeed: UnityMinMaxCurve;
    startSize3D: boolean;
    startSize: UnityMinMaxCurve;
    startSizeX: UnityMinMaxCurve;
    startSizeY: UnityMinMaxCurve;
    startSizeZ: UnityMinMaxCurve;
    startRotation3D: boolean;
    startRotation: UnityMinMaxCurve;
    startRotationX: UnityMinMaxCurve;
    startRotationY: UnityMinMaxCurve;
    startColor: UnityMinMaxGradient;
    gravityModifier: UnityMinMaxCurve;
    simulationSpeed: number;
    simulationSpace: number;
    maxParticles: number;
    playOnAwake: boolean;
  };
  // Emission Module
  emission: {
    enabled: boolean;
    rateOverTime: UnityMinMaxCurve;
    rateOverDistance: UnityMinMaxCurve;
    bursts: UnityBurst[];
  };
  // Shape Module
  shape: {
    enabled: boolean;
    type: number; // 0: Sphere, 1: Hemisphere, 2: Cone, 3: Box, etc.
    radius: number;
    radiusThickness: number; // 0 = surface, 1 = volume
    angle: number;
    length: number;
    donutRadius: number; // Donut shape의 내부 반지름
    arc: number; // Arc 각도 (도넛, 원 등에서 사용)
    scale: { x: number; y: number; z: number };
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    randomDirectionAmount: number;
    sphericalDirectionAmount: number;
  };
  // Velocity Over Lifetime
  velocityOverLifetime: {
    enabled: boolean;
    x: UnityMinMaxCurve;
    y: UnityMinMaxCurve;
    z: UnityMinMaxCurve;
    space: number;
  };
  // Force Over Lifetime
  forceOverLifetime: {
    enabled: boolean;
    x: UnityMinMaxCurve;
    y: UnityMinMaxCurve;
    z: UnityMinMaxCurve;
    space: number;
  };
  // Color Over Lifetime
  colorOverLifetime: {
    enabled: boolean;
    color: UnityMinMaxGradient;
  };
  // Size Over Lifetime
  sizeOverLifetime: {
    enabled: boolean;
    size: UnityMinMaxCurve;
    separateAxes: boolean;
    x: UnityMinMaxCurve;
    y: UnityMinMaxCurve;
    z: UnityMinMaxCurve;
  };
  // Rotation Over Lifetime
  rotationOverLifetime: {
    enabled: boolean;
    separateAxes: boolean;
    x: UnityMinMaxCurve;
    y: UnityMinMaxCurve;
    z: UnityMinMaxCurve;
  };
  // Noise Module
  noise: {
    enabled: boolean;
    strength: UnityMinMaxCurve;
    frequency: number;
    scrollSpeed: UnityMinMaxCurve;
    positionAmount: UnityMinMaxCurve;
    rotationAmount: UnityMinMaxCurve;
    sizeAmount: UnityMinMaxCurve;
  };
  // Texture Sheet Animation (UVModule)
  textureSheetAnimation: {
    enabled: boolean;
    mode: number; // 0: Grid, 1: Sprites
    tilesX: number;
    tilesY: number;
    animationType: number; // 0: WholeSheet, 1: SingleRow
    rowIndex: number;
    frameOverTime: UnityMinMaxCurve;
    startFrame: UnityMinMaxCurve;
    cycles: number;
  };
  // Trail Module
  trail: {
    enabled: boolean;
    ratio: number; // 0~1, 몇 퍼센트의 파티클이 trail을 가질지
    lifetime: UnityMinMaxCurve;
    minVertexDistance: number;
    worldSpace: boolean;
    dieWithParticles: boolean;
    sizeAffectsWidth: boolean;
    sizeAffectsLifetime: boolean;
    inheritParticleColor: boolean;
    colorOverLifetime: UnityMinMaxGradient;
    widthOverTrail: UnityMinMaxCurve;
    colorOverTrail: UnityMinMaxGradient;
  };
  // Renderer
  renderer: {
    material: { fileID: number; guid?: string };
    renderMode: number;
    sortMode: number;
    lengthScale: number;
    velocityScale: number;
  };
}

export interface UnityMinMaxCurve {
  mode: number; // 0: Constant, 1: Curve, 2: TwoCurves, 3: TwoConstants
  constant?: number;
  constantMin?: number;
  constantMax?: number;
  curve?: UnityCurve;
  curveMin?: UnityCurve;
  curveMax?: UnityCurve;
}

export interface UnityCurve {
  serializedVersion: number;
  m_Curve: UnityKeyframe[];
  m_PreInfinity: number;
  m_PostInfinity: number;
}

export interface UnityKeyframe {
  time: number;
  value: number;
  inSlope: number;
  outSlope: number;
  tangentMode: number;
  weightedMode: number;
  inWeight: number;
  outWeight: number;
}

export interface UnityMinMaxGradient {
  mode: number;
  color?: UnityColor;
  colorMin?: UnityColor;
  colorMax?: UnityColor;
  gradient?: UnityGradient;
  gradientMin?: UnityGradient;
  gradientMax?: UnityGradient;
}

export interface UnityColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface UnityGradient {
  serializedVersion: number;
  key0: UnityColor;
  key1: UnityColor;
  key2: UnityColor;
  key3: UnityColor;
  key4: UnityColor;
  key5: UnityColor;
  key6: UnityColor;
  key7: UnityColor;
  ctime0: number;
  ctime1: number;
  ctime2: number;
  ctime3: number;
  ctime4: number;
  ctime5: number;
  ctime6: number;
  ctime7: number;
  atime0: number;
  atime1: number;
  atime2: number;
  atime3: number;
  atime4: number;
  atime5: number;
  atime6: number;
  atime7: number;
  m_NumColorKeys: number;
  m_NumAlphaKeys: number;
}

export interface UnityBurst {
  time: number;
  countCurve: UnityMinMaxCurve;
  cycleCount: number;
  repeatInterval: number;
  probability: number;
}

// Unity Class ID 상수
const UNITY_CLASS_IDS = {
  GameObject: 1,
  Transform: 4,
  ParticleSystem: 198,
  ParticleSystemRenderer: 199,
  Material: 21,
};

// ParticleSystemRenderer 데이터
export interface UnityParticleSystemRenderer {
  fileId: number;
  gameObject: { fileID: number };
  renderMode: number; // 0: Billboard, 1: Stretch, 2: HorizontalBillboard, 3: VerticalBillboard, 4: Mesh
  sortMode: number;
  lengthScale: number;
  velocityScale: number;
  normalDirection: number;
}

/**
 * Unity YAML 파일 파싱
 * Unity는 여러 YAML 문서를 --- 구분자로 연결하고
 * 각 문서 헤더에 !u!<classId> &<fileId> 형식을 사용함
 */
export function parseUnityYaml(content: string): UnityDocument {
  const objects: UnityObject[] = [];
  const gameObjects: UnityGameObject[] = [];
  const particleSystems: UnityParticleSystem[] = [];
  const particleSystemRenderers: Map<number, UnityParticleSystemRenderer> = new Map();
  const transforms: Map<number, UnityTransform> = new Map();

  // %YAML 1.1 및 %TAG 헤더 제거
  const cleanContent = content
    .replace(/%YAML.*\n/g, '')
    .replace(/%TAG.*\n/g, '');

  // --- 구분자로 문서 분리
  const documents = cleanContent.split(/^---\s*/m).filter(doc => doc.trim());

  for (const doc of documents) {
    // !u!<classId> &<fileId> 패턴 추출
    const headerMatch = doc.match(/^!u!(\d+)\s+&(\d+)/);
    if (!headerMatch) continue;

    const classId = parseInt(headerMatch[1], 10);
    const fileId = parseInt(headerMatch[2], 10);

    // 헤더 제거 후 YAML 파싱
    const yamlContent = doc.replace(/^!u!\d+\s+&\d+\s*\n?/, '');

    try {
      const parsed = YAML.parse(yamlContent);
      if (!parsed) continue;

      const data = Object.values(parsed)[0] as Record<string, unknown>;

      objects.push({ classId, fileId, data });

      // 타입별 처리
      if (classId === UNITY_CLASS_IDS.GameObject) {
        const go = parseGameObject(fileId, data);
        if (go) gameObjects.push(go);
      } else if (classId === UNITY_CLASS_IDS.Transform) {
        const transform = parseTransform(fileId, data);
        if (transform) transforms.set(fileId, transform);
      } else if (classId === UNITY_CLASS_IDS.ParticleSystem) {
        const ps = parseParticleSystem(fileId, data);
        if (ps) particleSystems.push(ps);
      } else if (classId === UNITY_CLASS_IDS.ParticleSystemRenderer) {
        const psr = parseParticleSystemRenderer(fileId, data);
        if (psr) {
          // gameObject fileID를 키로 사용
          particleSystemRenderers.set(psr.gameObject.fileID, psr);
        }
      }
    } catch (e) {
      console.warn(`Failed to parse document with fileId ${fileId}:`, e);
    }
  }

  return { objects, gameObjects, particleSystems, particleSystemRenderers };
}

function parseParticleSystemRenderer(fileId: number, data: Record<string, unknown>): UnityParticleSystemRenderer | null {
  return {
    fileId,
    gameObject: data.m_GameObject as { fileID: number } || { fileID: 0 },
    renderMode: parseInt(String(data.m_RenderMode)) || 0,
    sortMode: parseInt(String(data.m_SortMode)) || 0,
    lengthScale: parseFloat(String(data.m_LengthScale)) || 2,
    velocityScale: parseFloat(String(data.m_VelocityScale)) || 0,
    normalDirection: parseFloat(String(data.m_NormalDirection)) || 1,
  };
}

function parseGameObject(fileId: number, data: Record<string, unknown>): UnityGameObject | null {
  return {
    fileId,
    name: (data.m_Name as string) || 'Unknown',
    components: (data.m_Component as Array<{ component: { fileID: number } }> || [])
      .map(c => ({ fileID: c.component?.fileID || 0 })),
    children: [],
  };
}

function parseTransform(fileId: number, data: Record<string, unknown>): UnityTransform | null {
  const localPos = data.m_LocalPosition as { x: number; y: number; z: number } || { x: 0, y: 0, z: 0 };
  const localRot = data.m_LocalRotation as { x: number; y: number; z: number; w: number } || { x: 0, y: 0, z: 0, w: 1 };
  const localScale = data.m_LocalScale as { x: number; y: number; z: number } || { x: 1, y: 1, z: 1 };

  return {
    fileId,
    gameObject: data.m_GameObject as { fileID: number } || { fileID: 0 },
    localPosition: parseVector3(localPos),
    localRotation: { ...parseVector3(localRot), w: parseFloat(String(localRot.w)) || 1 },
    localScale: parseVector3(localScale),
    children: (data.m_Children as Array<{ fileID: number }>) || [],
    father: data.m_Father as { fileID: number } || { fileID: 0 },
  };
}

function parseVector3(v: { x: number | string; y: number | string; z: number | string }): { x: number; y: number; z: number } {
  return {
    x: parseFloat(String(v.x)) || 0,
    y: parseFloat(String(v.y)) || 0,
    z: parseFloat(String(v.z)) || 0,
  };
}

function parseParticleSystem(fileId: number, data: Record<string, unknown>): UnityParticleSystem | null {
  const ps = data as Record<string, unknown>;

  console.log('=== ParticleSystem raw data keys ===');
  console.log(Object.keys(ps));

  // 기본 파티클 시스템 구조 추출
  const mainModule = ps.InitialModule as Record<string, unknown> || {};
  console.log('=== InitialModule keys ===');
  console.log(Object.keys(mainModule));
  console.log('InitialModule.startColor:', JSON.stringify(mainModule.startColor, null, 2));
  const emissionModule = ps.EmissionModule as Record<string, unknown> || {};
  const shapeModule = ps.ShapeModule as Record<string, unknown> || {};
  const velocityModule = ps.VelocityModule as Record<string, unknown> || {};
  const colorModule = ps.ColorModule as Record<string, unknown> || {};
  console.log('=== ColorModule ===');
  console.log('colorModule.enabled:', colorModule.enabled, '-> Boolean:', Boolean(colorModule.enabled));
  console.log('colorModule.gradient:', JSON.stringify(colorModule.gradient, null, 2));
  const sizeModule = ps.SizeModule as Record<string, unknown> || {};
  const rotationModule = ps.RotationModule as Record<string, unknown> || {};
  const noiseModule = ps.NoiseModule as Record<string, unknown> || {};
  const forceModule = ps.ForceModule as Record<string, unknown> || {};
  const trailModule = ps.TrailModule as Record<string, unknown> || {};
  const uvModule = ps.UVModule as Record<string, unknown> || {};
  console.log('=== UVModule (TextureSheetAnimation) ===');
  console.log('uvModule.enabled:', uvModule.enabled);
  console.log('uvModule.tilesX:', uvModule.tilesX, 'tilesY:', uvModule.tilesY);

  return {
    fileId,
    gameObject: ps.m_GameObject as { fileID: number } || { fileID: 0 },
    main: {
      duration: parseFloat(String(ps.lengthInSec)) || 5,
      loop: Boolean(ps.looping),
      startDelay: parseMinMaxCurve(mainModule.startDelay),
      startLifetime: parseMinMaxCurve(mainModule.startLifetime),
      startSpeed: parseMinMaxCurve(mainModule.startSpeed),
      startSize3D: Boolean(mainModule.startSize3D),
      startSize: parseMinMaxCurve(mainModule.startSize),
      startSizeX: parseMinMaxCurve(mainModule.startSizeX),
      startSizeY: parseMinMaxCurve(mainModule.startSizeY),
      startSizeZ: parseMinMaxCurve(mainModule.startSizeZ),
      startRotation3D: Boolean(mainModule.startRotation3D),
      startRotation: parseMinMaxCurve(mainModule.startRotation),
      startRotationX: parseMinMaxCurve(mainModule.startRotationX),
      startRotationY: parseMinMaxCurve(mainModule.startRotationY),
      startColor: parseMinMaxGradient(mainModule.startColor),
      gravityModifier: parseMinMaxCurve(mainModule.gravityModifier),
      simulationSpeed: parseFloat(String(mainModule.simulationSpeed)) || 1,
      simulationSpace: parseInt(String(ps.moveWithTransform)) || 0,
      maxParticles: parseInt(String(mainModule.maxNumParticles)) || 1000,
      playOnAwake: Boolean(ps.playOnAwake),
    },
    emission: {
      enabled: Boolean(emissionModule.enabled),
      rateOverTime: parseMinMaxCurve(emissionModule.rateOverTime),
      rateOverDistance: parseMinMaxCurve(emissionModule.rateOverDistance),
      bursts: parseBursts(emissionModule.m_Bursts),
    },
    shape: {
      enabled: Boolean(shapeModule.enabled),
      type: parseInt(String(shapeModule.type)) || 0,
      radius: parseFloat(String(shapeModule.radius)) || 1,
      radiusThickness: shapeModule.radiusThickness !== undefined ? parseFloat(String(shapeModule.radiusThickness)) : 1,
      angle: parseFloat(String(shapeModule.angle)) || 25,
      length: parseFloat(String(shapeModule.length)) || 5,
      donutRadius: parseFloat(String(shapeModule.donutRadius)) || 0.2,
      arc: parseFloat(String(shapeModule.arc)) || 360,
      scale: parseVector3(shapeModule.scale as { x: number; y: number; z: number } || { x: 1, y: 1, z: 1 }),
      position: parseVector3(shapeModule.position as { x: number; y: number; z: number } || { x: 0, y: 0, z: 0 }),
      rotation: parseVector3(shapeModule.rotation as { x: number; y: number; z: number } || { x: 0, y: 0, z: 0 }),
      randomDirectionAmount: parseFloat(String(shapeModule.randomDirectionAmount)) || 0,
      sphericalDirectionAmount: parseFloat(String(shapeModule.sphericalDirectionAmount)) || 0,
    },
    velocityOverLifetime: {
      enabled: Boolean(velocityModule.enabled),
      x: parseMinMaxCurve(velocityModule.x),
      y: parseMinMaxCurve(velocityModule.y),
      z: parseMinMaxCurve(velocityModule.z),
      space: parseInt(String(velocityModule.inWorldSpace)) || 0,
    },
    forceOverLifetime: {
      enabled: Boolean(forceModule.enabled),
      x: parseMinMaxCurve(forceModule.x),
      y: parseMinMaxCurve(forceModule.y),
      z: parseMinMaxCurve(forceModule.z),
      space: parseInt(String(forceModule.inWorldSpace)) || 0,
    },
    colorOverLifetime: {
      enabled: Boolean(colorModule.enabled),
      color: parseMinMaxGradient(colorModule.gradient),
    },
    sizeOverLifetime: {
      enabled: Boolean(sizeModule.enabled),
      size: parseMinMaxCurve(sizeModule.curve),
      separateAxes: Boolean(sizeModule.separateAxes),
      x: parseMinMaxCurve(sizeModule.x),
      y: parseMinMaxCurve(sizeModule.y),
      z: parseMinMaxCurve(sizeModule.z),
    },
    rotationOverLifetime: {
      enabled: Boolean(rotationModule.enabled),
      separateAxes: Boolean(rotationModule.separateAxes),
      x: parseMinMaxCurve(rotationModule.x),
      y: parseMinMaxCurve(rotationModule.y),
      z: parseMinMaxCurve(rotationModule.z),
    },
    noise: {
      enabled: Boolean(noiseModule.enabled),
      strength: parseMinMaxCurve(noiseModule.strength),
      frequency: parseFloat(String(noiseModule.frequency)) || 0.5,
      scrollSpeed: parseMinMaxCurve(noiseModule.scrollSpeed),
      positionAmount: parseMinMaxCurve(noiseModule.positionAmount),
      rotationAmount: parseMinMaxCurve(noiseModule.rotationAmount),
      sizeAmount: parseMinMaxCurve(noiseModule.sizeAmount),
    },
    trail: {
      enabled: Boolean(trailModule.enabled),
      ratio: parseFloat(String(trailModule.ratio)) || 1,
      lifetime: parseMinMaxCurve(trailModule.lifetime),
      minVertexDistance: parseFloat(String(trailModule.minVertexDistance)) || 0.2,
      worldSpace: Boolean(trailModule.worldSpace),
      dieWithParticles: trailModule.dieWithParticles !== undefined ? Boolean(trailModule.dieWithParticles) : true,
      sizeAffectsWidth: Boolean(trailModule.sizeAffectsWidth),
      sizeAffectsLifetime: Boolean(trailModule.sizeAffectsLifetime),
      inheritParticleColor: trailModule.inheritParticleColor !== undefined ? Boolean(trailModule.inheritParticleColor) : true,
      colorOverLifetime: parseMinMaxGradient(trailModule.colorOverLifetime),
      widthOverTrail: parseMinMaxCurve(trailModule.widthOverTrail),
      colorOverTrail: parseMinMaxGradient(trailModule.colorOverTrail),
    },
    textureSheetAnimation: {
      enabled: Boolean(uvModule.enabled),
      mode: parseInt(String(uvModule.mode)) || 0,
      tilesX: parseInt(String(uvModule.tilesX)) || 1,
      tilesY: parseInt(String(uvModule.tilesY)) || 1,
      animationType: parseInt(String(uvModule.animationType)) || 0,
      rowIndex: parseInt(String(uvModule.rowIndex)) || 0,
      frameOverTime: parseMinMaxCurve(uvModule.frameOverTime),
      startFrame: parseMinMaxCurve(uvModule.startFrame),
      cycles: parseFloat(String(uvModule.cycles)) || 1,
    },
    renderer: {
      material: { fileID: 0 },
      renderMode: 0,
      sortMode: 0,
      lengthScale: 0,
      velocityScale: 0,
    },
  };
}

function parseMinMaxCurve(data: unknown): UnityMinMaxCurve {
  if (!data || typeof data !== 'object') {
    return { mode: 0, constant: 1 };
  }

  const d = data as Record<string, unknown>;
  const mode = parseInt(String(d.minMaxState ?? d.mode)) || 0;

  return {
    mode,
    constant: parseFloat(String(d.scalar ?? d.constant)) || 0,
    constantMin: parseFloat(String(d.minScalar ?? d.constantMin)) || 0,
    constantMax: parseFloat(String(d.scalar ?? d.constantMax)) || 0,
    curve: d.minCurve ? parseCurve(d.minCurve) : undefined,
    curveMin: d.minCurve ? parseCurve(d.minCurve) : undefined,
    curveMax: d.maxCurve ? parseCurve(d.maxCurve) : undefined,
  };
}

function parseCurve(data: unknown): UnityCurve | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const d = data as Record<string, unknown>;
  const curveData = d.m_Curve as unknown[];

  return {
    serializedVersion: parseInt(String(d.serializedVersion)) || 2,
    m_Curve: Array.isArray(curveData) ? curveData.map(parseKeyframe) : [],
    m_PreInfinity: parseInt(String(d.m_PreInfinity)) || 2,
    m_PostInfinity: parseInt(String(d.m_PostInfinity)) || 2,
  };
}

function parseKeyframe(data: unknown): UnityKeyframe {
  const d = (data || {}) as Record<string, unknown>;
  return {
    time: parseFloat(String(d.time)) || 0,
    value: parseFloat(String(d.value)) || 0,
    inSlope: parseFloat(String(d.inSlope)) || 0,
    outSlope: parseFloat(String(d.outSlope)) || 0,
    tangentMode: parseInt(String(d.tangentMode)) || 0,
    weightedMode: parseInt(String(d.weightedMode)) || 0,
    inWeight: parseFloat(String(d.inWeight)) || 0,
    outWeight: parseFloat(String(d.outWeight)) || 0,
  };
}

function parseMinMaxGradient(data: unknown): UnityMinMaxGradient {
  if (!data || typeof data !== 'object') {
    return { mode: 0, color: { r: 1, g: 1, b: 1, a: 1 } };
  }

  const d = data as Record<string, unknown>;
  console.log('parseMinMaxGradient 입력 데이터:', JSON.stringify(d, null, 2));

  // Unity uses 'minMaxState' for the mode
  // 0: Constant Color, 1: Gradient, 2: Random Between Two Colors, 3: Random Between Two Gradients
  const mode = parseInt(String(d.minMaxState ?? d.mode)) || 0;
  console.log('gradient mode (minMaxState):', mode);

  // Unity 색상 구조:
  // - minMaxState: 0 (Constant) -> minColor 사용
  // - minMaxState: 2 (Random Between Two Colors) -> minColor, maxColor 둘 다 사용
  // - minMaxState: 1, 3 (Gradient) -> maxGradient 사용

  const minColor = parseColor(d.minColor);
  const maxColor = parseColor(d.maxColor);

  console.log('파싱된 minColor:', minColor);
  console.log('파싱된 maxColor:', maxColor);

  // mode 0 (Constant)에서는 minColor가 실제 색상
  const color = mode === 0 ? minColor : maxColor;

  const result: UnityMinMaxGradient = {
    mode,
    color,
    colorMin: minColor,
    colorMax: maxColor,
    gradient: d.maxGradient ? parseGradient(d.maxGradient) : undefined,
    gradientMin: d.minGradient ? parseGradient(d.minGradient) : undefined,
    gradientMax: d.maxGradient ? parseGradient(d.maxGradient) : undefined,
  };

  console.log('parseMinMaxGradient 결과:', JSON.stringify(result, null, 2));
  return result;
}

function parseColor(data: unknown): UnityColor {
  if (!data || typeof data !== 'object') {
    return { r: 1, g: 1, b: 1, a: 1 };
  }

  const d = data as Record<string, unknown>;
  // r이 0일 수 있으므로 || 0 대신 ?? 사용
  const r = d.r !== undefined ? parseFloat(String(d.r)) : 1;
  const g = d.g !== undefined ? parseFloat(String(d.g)) : 1;
  const b = d.b !== undefined ? parseFloat(String(d.b)) : 1;
  const a = d.a !== undefined ? parseFloat(String(d.a)) : 1;

  console.log('parseColor 입력:', JSON.stringify(d), '-> 결과:', { r, g, b, a });

  return { r, g, b, a };
}

function parseGradient(data: unknown): UnityGradient | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const d = data as Record<string, unknown>;
  return {
    serializedVersion: parseInt(String(d.serializedVersion)) || 2,
    key0: parseColor(d.key0),
    key1: parseColor(d.key1),
    key2: parseColor(d.key2),
    key3: parseColor(d.key3),
    key4: parseColor(d.key4),
    key5: parseColor(d.key5),
    key6: parseColor(d.key6),
    key7: parseColor(d.key7),
    ctime0: parseInt(String(d.ctime0)) || 0,
    ctime1: parseInt(String(d.ctime1)) || 0,
    ctime2: parseInt(String(d.ctime2)) || 0,
    ctime3: parseInt(String(d.ctime3)) || 0,
    ctime4: parseInt(String(d.ctime4)) || 0,
    ctime5: parseInt(String(d.ctime5)) || 0,
    ctime6: parseInt(String(d.ctime6)) || 0,
    ctime7: parseInt(String(d.ctime7)) || 0,
    atime0: parseInt(String(d.atime0)) || 0,
    atime1: parseInt(String(d.atime1)) || 0,
    atime2: parseInt(String(d.atime2)) || 0,
    atime3: parseInt(String(d.atime3)) || 0,
    atime4: parseInt(String(d.atime4)) || 0,
    atime5: parseInt(String(d.atime5)) || 0,
    atime6: parseInt(String(d.atime6)) || 0,
    atime7: parseInt(String(d.atime7)) || 0,
    m_NumColorKeys: parseInt(String(d.m_NumColorKeys)) || 2,
    m_NumAlphaKeys: parseInt(String(d.m_NumAlphaKeys)) || 2,
  };
}

function parseBursts(data: unknown): UnityBurst[] {
  if (!Array.isArray(data)) return [];

  return data.map(b => {
    const burst = b as Record<string, unknown>;
    return {
      time: parseFloat(String(burst.time)) || 0,
      countCurve: parseMinMaxCurve(burst.countCurve),
      cycleCount: parseInt(String(burst.cycleCount)) || 1,
      repeatInterval: parseFloat(String(burst.repeatInterval)) || 0.01,
      probability: parseFloat(String(burst.probability)) || 1,
    };
  });
}
