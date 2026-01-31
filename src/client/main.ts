import * as THREE from 'three';
import {
  BatchedParticleRenderer,
  ParticleSystem,
  ConstantValue,
  IntervalValue,
  ConstantColor,
  SphereEmitter,
  ConeEmitter,
  PointEmitter,
  ColorOverLife,
  SizeOverLife,
  FrameOverLife,
  ColorRange,
  PiecewiseBezier,
  Bezier,
} from 'three.quarks';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// LocalStorage keys
const STORAGE_KEYS = {
  assetsPath: 'unity-quarks-assets-path',
  selectedPrefab: 'unity-quarks-selected-prefab',
  currentDir: 'unity-quarks-current-dir',
};

// State
let assetsPath = '';
let selectedPrefab = '';
let currentDir = '';
let currentQuarksJson: unknown = null;

// Three.js
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let batchRenderer: BatchedParticleRenderer;
let particleSystems: ParticleSystem[] = [];

// FPS 계산용
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
let statsElement: HTMLDivElement | null = null;

// DOM Elements
const assetsPathInput = document.getElementById('assets-path') as HTMLInputElement;
const fileTree = document.getElementById('file-tree') as HTMLDivElement;
const previewInfo = document.getElementById('preview-info') as HTMLDivElement;
const logContainer = document.getElementById('log') as HTMLElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const btnConvert = document.getElementById('btn-convert') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;

// Initialize
init();

async function init() {
  initThreeJS();
  initEventListeners();
  await restoreFromStorage();
  animate();
}

function initThreeJS() {
  const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
  const container = canvas.parentElement!;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 10);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Grid Helper
  const gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x222222);
  scene.add(gridHelper);

  // Axis Helper
  const axisHelper = new THREE.AxesHelper(5);
  scene.add(axisHelper);

  // Batch Renderer for particles
  batchRenderer = new BatchedParticleRenderer();
  scene.add(batchRenderer);

  // Stats 표시 엘리먼트 생성
  statsElement = document.createElement('div');
  statsElement.style.cssText = `
    position: absolute;
    top: 50px;
    right: 12px;
    background: rgba(0, 0, 0, 0.7);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    color: #4ecca3;
    pointer-events: none;
  `;
  container.appendChild(statsElement);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}


function initEventListeners() {
  // Assets path input
  assetsPathInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      assetsPath = assetsPathInput.value.trim();
      if (assetsPath) {
        localStorage.setItem(STORAGE_KEYS.assetsPath, assetsPath);
        await loadDirectory(assetsPath);
      }
    }
  });

  // Refresh button
  btnRefresh.addEventListener('click', async () => {
    if (assetsPath) {
      await loadDirectory(assetsPath);
    }
  });

  // Convert button
  btnConvert.addEventListener('click', async () => {
    if (selectedPrefab) {
      await convertPrefab(selectedPrefab);
    } else {
      log('Prefab을 먼저 선택하세요', 'error');
    }
  });

  // Save button
  btnSave.addEventListener('click', async () => {
    if (currentQuarksJson) {
      await savePrefab();
    } else {
      log('먼저 변환을 실행하세요', 'error');
    }
  });
}

async function restoreFromStorage() {
  const savedAssetsPath = localStorage.getItem(STORAGE_KEYS.assetsPath);
  const savedPrefab = localStorage.getItem(STORAGE_KEYS.selectedPrefab);
  const savedCurrentDir = localStorage.getItem(STORAGE_KEYS.currentDir);

  if (savedAssetsPath) {
    assetsPath = savedAssetsPath;
    assetsPathInput.value = savedAssetsPath;
    log(`저장된 경로 복원: ${savedAssetsPath}`);

    try {
      // 현재 디렉토리가 저장되어 있으면 그 폴더로, 아니면 assetsPath로
      const dirToLoad = savedCurrentDir || savedAssetsPath;
      currentDir = dirToLoad;
      await loadDirectory(dirToLoad);

      if (savedPrefab) {
        selectedPrefab = savedPrefab;
        log(`저장된 Prefab 복원: ${savedPrefab.split('/').pop()}`);
        await previewPrefab(savedPrefab);
      }
    } catch (error) {
      log(`복원 실패: ${error}`, 'error');
    }
  }
}

async function loadDirectory(dirPath: string) {
  try {
    log(`폴더 로딩: ${dirPath}`);
    const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    currentDir = dirPath;
    localStorage.setItem(STORAGE_KEYS.currentDir, dirPath);

    renderFileTree(data.items, dirPath);
    log(`${data.items.length}개 항목 로드됨`, 'success');
  } catch (error) {
    log(`폴더 로딩 실패: ${error}`, 'error');
    fileTree.innerHTML = '<div class="loading">폴더를 찾을 수 없습니다</div>';
  }
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isPrefab: boolean;
}

function renderFileTree(items: FileItem[], basePath: string) {
  fileTree.innerHTML = '';

  // Back button if not root
  if (basePath !== assetsPath) {
    const backItem = document.createElement('div');
    backItem.className = 'tree-item folder';
    backItem.textContent = '..';
    backItem.addEventListener('click', () => {
      const parentPath = basePath.split('/').slice(0, -1).join('/');
      loadDirectory(parentPath || assetsPath);
    });
    fileTree.appendChild(backItem);
  }

  for (const item of items) {
    const div = document.createElement('div');
    div.className = `tree-item ${item.isDirectory ? 'folder' : 'prefab'}`;
    div.textContent = item.name;

    // 저장된 prefab이면 선택 표시
    if (item.path === selectedPrefab) {
      div.classList.add('selected');
    }

    if (item.isDirectory) {
      div.addEventListener('click', () => loadDirectory(item.path));
    } else if (item.isPrefab) {
      div.addEventListener('click', () => selectPrefab(item.path, div));
    }

    fileTree.appendChild(div);
  }

  if (items.length === 0) {
    fileTree.innerHTML = '<div class="loading">빈 폴더</div>';
  }
}

function selectPrefab(path: string, element: HTMLElement) {
  // Remove previous selection
  document.querySelectorAll('.tree-item.selected').forEach(el => {
    el.classList.remove('selected');
  });

  // Select new
  element.classList.add('selected');
  selectedPrefab = path;
  localStorage.setItem(STORAGE_KEYS.selectedPrefab, path);
  log(`선택됨: ${path.split('/').pop()}`);

  // Auto preview
  previewPrefab(path);
}

async function previewPrefab(prefabPath: string) {
  try {
    log('미리보기 생성 중...');

    // assetsRoot도 전달
    const url = `/api/preview?path=${encodeURIComponent(prefabPath)}&assetsRoot=${encodeURIComponent(assetsPath)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    currentQuarksJson = data.quarksJson;
    const psCount = data.quarksJson?.particleSystems?.length || 0;
    previewInfo.textContent = `파티클 시스템: ${psCount}개`;

    // 텍스처 정보 로그
    if (data.textures && data.textures.length > 0) {
      log(`텍스처 발견: ${data.textures.length}개`);
      console.log('텍스처 URL:', data.textures);
    }

    // Load into three.js (텍스처 정보 포함)
    await loadParticlePreview(data.quarksJson, data.textures);

    log('미리보기 로드 완료', 'success');
  } catch (error) {
    log(`미리보기 실패: ${error}`, 'error');
    previewInfo.textContent = `오류: ${error}`;
  }
}

async function loadParticlePreview(quarksJson: unknown, textureUrls?: string[]) {
  // Clear existing particles
  for (const ps of particleSystems) {
    batchRenderer.deleteSystem(ps);
    ps.emitter.parent?.remove(ps.emitter);
  }
  particleSystems = [];

  try {
    const json = quarksJson as { particleSystems: Array<Record<string, unknown>> };

    console.log('변환된 JSON:', JSON.stringify(json, null, 2));

    // 텍스처 로드
    let loadedTexture: THREE.Texture | null = null;
    if (textureUrls && textureUrls.length > 0) {
      const textureUrl = textureUrls[0];
      log(`텍스처 로드 시도: ${textureUrl}`);

      loadedTexture = await new Promise<THREE.Texture>((resolve, reject) => {
        new THREE.TextureLoader().load(
          textureUrl,
          (tex) => {
            log(`텍스처 로드 성공: ${textureUrl}`, 'success');
            resolve(tex);
          },
          undefined,
          (err) => {
            const errorMsg = `텍스처 로드 실패: ${textureUrl}`;
            log(errorMsg, 'error');
            console.error(errorMsg, err);
            reject(new Error(errorMsg));
          }
        );
      });
    } else {
      log('텍스처를 찾을 수 없음', 'error');
      throw new Error('Prefab에서 텍스처를 찾을 수 없습니다');
    }

    for (const psData of json.particleSystems) {
      console.log('파티클 시스템 데이터:', psData);
      const ps = createParticleSystemFromData(psData, loadedTexture);
      if (ps) {
        console.log('파티클 시스템 생성 성공:', ps);
        particleSystems.push(ps);
        batchRenderer.addSystem(ps);

        // 파티클 시스템 시작
        ps.emitter.position.set(0, 0, 0);
        scene.add(ps.emitter);
      }
    }

    log(`${particleSystems.length}개 파티클 시스템 로드됨`);
  } catch (error) {
    log(`파티클 로드 실패: ${error}`, 'error');
    console.error('파티클 로드 에러:', error);
  }
}

function createParticleSystemFromData(data: Record<string, unknown>, texture?: THREE.Texture | null): ParticleSystem | null {
  try {
    const duration = (data.duration as number) || 5;
    const looping = (data.looping as boolean) ?? true;

    // Shape 생성
    let shape;
    const shapeData = data.shape as Record<string, unknown> | undefined;
    if (shapeData) {
      const shapeType = shapeData.type as string;
      const radius = (shapeData.radius as number) || 1;

      switch (shapeType) {
        case 'cone':
          shape = new ConeEmitter({
            radius: radius,
            angle: (shapeData.angle as number) || 0.5,
          });
          break;
        case 'sphere':
          shape = new SphereEmitter({ radius: radius, thickness: 1 });
          break;
        default:
          shape = new PointEmitter();
      }
    } else {
      shape = new SphereEmitter({ radius: 1, thickness: 1 });
    }

    // StartLife 값 생성
    const startLifeData = data.startLife as Record<string, unknown> | undefined;
    let startLife;
    if (startLifeData?.type === 'interval') {
      startLife = new IntervalValue(
        (startLifeData.min as number) || 1,
        (startLifeData.max as number) || 3
      );
    } else {
      startLife = new ConstantValue((startLifeData?.value as number) || 2);
    }

    // StartSpeed 값 생성
    const startSpeedData = data.startSpeed as Record<string, unknown> | undefined;
    let startSpeed;
    if (startSpeedData?.type === 'interval') {
      startSpeed = new IntervalValue(
        (startSpeedData.min as number) || 0,
        (startSpeedData.max as number) || 1
      );
    } else {
      startSpeed = new ConstantValue((startSpeedData?.value as number) || 1);
    }

    // StartSize 값 생성
    const startSizeData = data.startSize as Record<string, unknown> | undefined;
    let startSize;
    if (startSizeData?.type === 'interval') {
      startSize = new IntervalValue(
        (startSizeData.min as number) || 0.1,
        (startSizeData.max as number) || 1
      );
    } else {
      startSize = new ConstantValue((startSizeData?.value as number) || 0.5);
    }

    // StartColor 값 생성
    const startColorData = data.startColor as Record<string, unknown> | undefined;
    console.log('startColorData:', JSON.stringify(startColorData, null, 2));

    const color = startColorData?.color as Record<string, number> | undefined;
    console.log('color:', color);

    // 색상 값이 실제로 있는지 확인 (0도 유효한 값)
    const r = color?.r !== undefined ? color.r : 1;
    const g = color?.g !== undefined ? color.g : 1;
    const b = color?.b !== undefined ? color.b : 1;
    const a = color?.a !== undefined ? color.a : 1;

    console.log('파티클 색상:', { r, g, b, a });

    const startColor = new ConstantColor(
      new THREE.Vector4(r, g, b, a)
    );

    // Emission rate
    const emissionData = data.emission as Record<string, unknown> | undefined;
    const rateData = emissionData?.rateOverTime as Record<string, unknown> | undefined;
    let emissionOverTime;
    if (rateData?.type === 'interval') {
      emissionOverTime = new IntervalValue(
        (rateData.min as number) || 1,
        (rateData.max as number) || 10
      );
    } else {
      emissionOverTime = new ConstantValue((rateData?.value as number) || 10);
    }

    // Material 생성 (전달된 텍스처만 사용)
    if (!texture) {
      throw new Error('텍스처가 없습니다');
    }

    console.log('Material 색상 적용:', { r, g, b });

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color(r, g, b),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Texture Sheet Animation 데이터
    const tsaData = data.textureSheetAnimation as Record<string, unknown> | undefined;
    const hasTSA = tsaData?.enabled === true;
    const tilesX = hasTSA ? (tsaData.tilesX as number) || 1 : 1;
    const tilesY = hasTSA ? (tsaData.tilesY as number) || 1 : 1;

    console.log('Texture Sheet Animation:', { enabled: hasTSA, tilesX, tilesY });

    const ps = new ParticleSystem({
      duration,
      looping,
      startLife,
      startSpeed,
      startSize,
      startColor,
      worldSpace: (data.worldSpace as boolean) ?? true,
      maxParticle: (data.maxParticles as number) || 1000,
      emissionOverTime,
      emissionOverDistance: new ConstantValue(0),
      shape,
      material,
      renderMode: 0, // Billboard
      renderOrder: 0,
      uTileCount: tilesX,
      vTileCount: tilesY,
      startTileIndex: new ConstantValue(0),
    });

    // Texture Sheet Animation behavior 추가
    if (hasTSA && tilesX * tilesY > 1) {
      const totalFrames = tilesX * tilesY;
      // FrameOverLife: 0에서 totalFrames-1까지 선형 진행
      ps.addBehavior(
        new FrameOverLife(
          new PiecewiseBezier([[new Bezier(0, 0, totalFrames, totalFrames), 0]])
        )
      );
      console.log('FrameOverLife behavior 추가됨, totalFrames:', totalFrames);
    }

    // Behaviors 추가
    const behaviors = data.behaviors as Array<Record<string, unknown>> | undefined;
    if (behaviors) {
      for (const behavior of behaviors) {
        try {
          addBehaviorToSystem(ps, behavior);
        } catch (e) {
          console.warn('Behavior 추가 실패:', e);
        }
      }
    }

    return ps;
  } catch (error) {
    console.error('파티클 생성 실패:', error);
    return null;
  }
}

function addBehaviorToSystem(ps: ParticleSystem, behavior: Record<string, unknown>) {
  const type = behavior.type as string;
  console.log('=== addBehaviorToSystem ===');
  console.log('behavior type:', type);
  console.log('behavior 전체:', JSON.stringify(behavior, null, 2));

  switch (type) {
    case 'ColorOverLife': {
      const colorData = behavior.color as Record<string, unknown> | undefined;
      console.log('ColorOverLife colorData:', JSON.stringify(colorData, null, 2));

      if (colorData?.type === 'gradient') {
        const gradient = colorData.gradient as Array<{ t: number; color: Record<string, number> }>;
        console.log('gradient array:', JSON.stringify(gradient, null, 2));

        if (gradient && gradient.length >= 2) {
          const startColor = gradient[0].color;
          const endColor = gradient[gradient.length - 1].color;
          console.log('startColor:', startColor, 'endColor:', endColor);

          ps.addBehavior(
            new ColorOverLife(
              new ColorRange(
                new THREE.Vector4(startColor.r, startColor.g, startColor.b, startColor.a),
                new THREE.Vector4(endColor.r, endColor.g, endColor.b, endColor.a)
              )
            )
          );
          console.log('ColorOverLife behavior 추가됨');
        }
      } else {
        console.log('colorData.type이 gradient가 아님:', colorData?.type);
      }
      break;
    }
    case 'SizeOverLife': {
      const sizeData = behavior.size as Record<string, unknown> | undefined;
      if (sizeData) {
        ps.addBehavior(
          new SizeOverLife(
            new PiecewiseBezier([[new Bezier(1, 0.75, 0.5, 0), 0]])
          )
        );
      }
      break;
    }
  }
}

async function convertPrefab(prefabPath: string) {
  try {
    log('변환 중...');

    const response = await fetch(`/api/preview?path=${encodeURIComponent(prefabPath)}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    currentQuarksJson = data.quarksJson;

    // Reload preview
    await loadParticlePreview(data.quarksJson);

    log('변환 완료', 'success');
    previewInfo.textContent = `변환 완료: ${data.quarksJson.particleSystems.length}개 파티클 시스템`;
  } catch (error) {
    log(`변환 실패: ${error}`, 'error');
  }
}

async function savePrefab() {
  if (!currentQuarksJson || !selectedPrefab) {
    log('저장할 데이터가 없습니다', 'error');
    return;
  }

  const outputPath = prompt('저장할 출력 폴더 경로를 입력하세요:');
  if (!outputPath) return;

  try {
    log('저장 중...');

    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefabPath: selectedPrefab,
        assetsRoot: assetsPath,
        outputRoot: outputPath,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    log(`저장 완료: ${data.outputPath}`, 'success');
    if (data.copiedAssets.length > 0) {
      log(`복사된 에셋: ${data.copiedAssets.length}개`);
    }
  } catch (error) {
    log(`저장 실패: ${error}`, 'error');
  }
}

function log(message: string, type?: 'error' | 'success') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type || ''}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function animate() {
  requestAnimationFrame(animate);

  // FPS 계산
  frameCount++;
  const currentTime = performance.now();
  if (currentTime - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = currentTime;
  }

  // 파티클 수 계산
  let totalParticles = 0;
  for (const ps of particleSystems) {
    totalParticles += ps.particleNum;
  }

  // Stats 업데이트
  if (statsElement) {
    statsElement.innerHTML = `FPS: ${fps}<br>Particles: ${totalParticles}<br>Systems: ${particleSystems.length}`;
  }

  const delta = 0.016; // ~60fps

  // Update particles
  batchRenderer.update(delta);

  controls.update();
  renderer.render(scene, camera);
}
