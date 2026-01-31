import * as THREE from 'three';
import {
  BatchedParticleRenderer,
  ParticleSystem,
  ConstantValue,
  IntervalValue,
  ConstantColor,
  SphereEmitter,
  HemisphereEmitter,
  ConeEmitter,
  DonutEmitter,
  CircleEmitter,
  RectangleEmitter,
  PointEmitter,
  ColorOverLife,
  SizeOverLife,
  FrameOverLife,
  ApplyForce,
  ColorRange,
  PiecewiseBezier,
  Bezier,
  Vector3Function,
  EulerGenerator,
} from 'three.quarks';

// ============================================
// Unity 스타일 카메라 컨트롤러
// ============================================
class UnityCameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // 마우스 상태
  private isRightMouseDown = false;
  private isMiddleMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // 키보드 상태
  private keys: { [key: string]: boolean } = {};

  // 카메라 회전 (Euler angles in radians)
  private yaw = 0; // Y축 회전
  private pitch = 0; // X축 회전

  // 설정
  private rotateSpeed = 0.003;
  private panSpeed = 0.01;
  private moveSpeed = 10;
  private zoomSpeed = 1;

  // 애니메이션
  private isAnimating = false;
  private animationStart: { position: THREE.Vector3; target: THREE.Vector3; yaw: number; pitch: number } | null = null;
  private animationEnd: { position: THREE.Vector3; target: THREE.Vector3; yaw: number; pitch: number } | null = null;
  private animationProgress = 0;
  private animationDuration = 0.3; // 초

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // 초기 yaw/pitch 계산
    this.updateAnglesFromCamera();

    this.setupEventListeners();
  }

  private updateAnglesFromCamera() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    this.yaw = Math.atan2(direction.x, direction.z);
    this.pitch = Math.asin(-direction.y);
  }

  private setupEventListeners() {
    // 마우스 이벤트
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('mouseleave', this.onMouseUp.bind(this));
    this.domElement.addEventListener('wheel', this.onWheel.bind(this));
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // 키보드 이벤트
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onMouseDown(event: MouseEvent) {
    if (event.button === 2) { // 우클릭
      this.isRightMouseDown = true;
      this.domElement.style.cursor = 'none';
    } else if (event.button === 1) { // 휠클릭
      this.isMiddleMouseDown = true;
      this.domElement.style.cursor = 'grab';
    }
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseMove(event: MouseEvent) {
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    if (this.isRightMouseDown) {
      // 우클릭 드래그: 회전
      this.yaw -= deltaX * this.rotateSpeed;
      this.pitch -= deltaY * this.rotateSpeed;

      // Pitch 제한 (-89도 ~ 89도)
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

      this.updateCameraRotation();
    } else if (this.isMiddleMouseDown) {
      // 휠클릭 드래그: 패닝
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();

      this.camera.getWorldDirection(new THREE.Vector3());
      right.setFromMatrixColumn(this.camera.matrix, 0);
      up.setFromMatrixColumn(this.camera.matrix, 1);

      const panX = -deltaX * this.panSpeed;
      const panY = deltaY * this.panSpeed;

      const offset = right.multiplyScalar(panX).add(up.multiplyScalar(panY));
      this.camera.position.add(offset);
      this.target.add(offset);
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseUp(event: MouseEvent) {
    if (event.button === 2) {
      this.isRightMouseDown = false;
    } else if (event.button === 1) {
      this.isMiddleMouseDown = false;
    }

    if (!this.isRightMouseDown && !this.isMiddleMouseDown) {
      this.domElement.style.cursor = 'default';
    }
  }

  private onWheel(event: WheelEvent) {
    event.preventDefault();

    // 카메라 방향으로 줌
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    const zoomAmount = -event.deltaY * 0.01 * this.zoomSpeed;
    this.camera.position.addScaledVector(direction, zoomAmount);
    this.target.addScaledVector(direction, zoomAmount);
  }

  private onKeyDown(event: KeyboardEvent) {
    // event.code 사용 (한글 IME에서도 동작)
    this.keys[event.code] = true;
  }

  private onKeyUp(event: KeyboardEvent) {
    this.keys[event.code] = false;
  }

  private updateCameraRotation() {
    // Yaw와 Pitch로 카메라 방향 계산
    const direction = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    // 타겟 업데이트
    const distance = this.camera.position.distanceTo(this.target);
    this.target.copy(this.camera.position).addScaledVector(direction, distance);

    this.camera.lookAt(this.target);
  }

  // 특정 방향으로 카메라 전환 (애니메이션)
  lookAt(direction: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom') {
    const distance = this.camera.position.distanceTo(this.target);
    const newPosition = new THREE.Vector3();
    let newYaw = 0;
    let newPitch = 0;

    switch (direction) {
      case 'front':
        newPosition.set(0, 0, distance);
        newYaw = 0;
        newPitch = 0;
        break;
      case 'back':
        newPosition.set(0, 0, -distance);
        newYaw = Math.PI;
        newPitch = 0;
        break;
      case 'left':
        newPosition.set(-distance, 0, 0);
        newYaw = Math.PI / 2;
        newPitch = 0;
        break;
      case 'right':
        newPosition.set(distance, 0, 0);
        newYaw = -Math.PI / 2;
        newPitch = 0;
        break;
      case 'top':
        newPosition.set(0, distance, 0);
        newYaw = 0;
        newPitch = -Math.PI / 2 + 0.01;
        break;
      case 'bottom':
        newPosition.set(0, -distance, 0);
        newYaw = 0;
        newPitch = Math.PI / 2 - 0.01;
        break;
    }

    // 원점을 타겟으로
    const newTarget = new THREE.Vector3(0, 0, 0);

    this.animationStart = {
      position: this.camera.position.clone(),
      target: this.target.clone(),
      yaw: this.yaw,
      pitch: this.pitch
    };

    this.animationEnd = {
      position: newPosition,
      target: newTarget,
      yaw: newYaw,
      pitch: newPitch
    };

    this.animationProgress = 0;
    this.isAnimating = true;
  }

  update(deltaTime: number) {
    // 애니메이션 처리
    if (this.isAnimating && this.animationStart && this.animationEnd) {
      this.animationProgress += deltaTime / this.animationDuration;

      if (this.animationProgress >= 1) {
        this.animationProgress = 1;
        this.isAnimating = false;
      }

      // Ease out
      const t = 1 - Math.pow(1 - this.animationProgress, 3);

      this.camera.position.lerpVectors(this.animationStart.position, this.animationEnd.position, t);
      this.target.lerpVectors(this.animationStart.target, this.animationEnd.target, t);
      this.yaw = this.animationStart.yaw + (this.animationEnd.yaw - this.animationStart.yaw) * t;
      this.pitch = this.animationStart.pitch + (this.animationEnd.pitch - this.animationStart.pitch) * t;

      this.camera.lookAt(this.target);
      return;
    }

    // WASD 이동 (우클릭 중일 때만)
    if (this.isRightMouseDown) {
      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();

      this.camera.getWorldDirection(forward);
      right.setFromMatrixColumn(this.camera.matrix, 0);

      const speed = this.moveSpeed * deltaTime;

      if (this.keys['KeyW']) {
        this.camera.position.addScaledVector(forward, speed);
        this.target.addScaledVector(forward, speed);
      }
      if (this.keys['KeyS']) {
        this.camera.position.addScaledVector(forward, -speed);
        this.target.addScaledVector(forward, -speed);
      }
      if (this.keys['KeyA']) {
        this.camera.position.addScaledVector(right, -speed);
        this.target.addScaledVector(right, -speed);
      }
      if (this.keys['KeyD']) {
        this.camera.position.addScaledVector(right, speed);
        this.target.addScaledVector(right, speed);
      }
      if (this.keys['KeyE']) {
        this.camera.position.y += speed;
        this.target.y += speed;
      }
      if (this.keys['KeyQ']) {
        this.camera.position.y -= speed;
        this.target.y -= speed;
      }
    }
  }

  getTarget(): THREE.Vector3 {
    return this.target;
  }
}

// ============================================
// 3D 좌표계 위젯 (ViewCube)
// ============================================
class ViewCubeWidget {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private mainCamera: THREE.PerspectiveCamera;
  private cameraController: UnityCameraController;

  private axisGroup: THREE.Group;
  private labels: { element: HTMLElement; axis: string; direction: number }[] = [];

  constructor(
    container: HTMLElement,
    mainCamera: THREE.PerspectiveCamera,
    cameraController: UnityCameraController
  ) {
    this.container = container;
    this.mainCamera = mainCamera;
    this.cameraController = cameraController;

    // 위젯 컨테이너 생성
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'view-cube-widget';
    widgetContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 100px;
      height: 100px;
      pointer-events: auto;
    `;
    container.appendChild(widgetContainer);

    // Scene
    this.scene = new THREE.Scene();

    // Camera (Orthographic)
    const size = 2.5;
    this.camera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    // Renderer
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width: 100%; height: 100%;';
    widgetContainer.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(100, 100);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // 축 그룹
    this.axisGroup = new THREE.Group();
    this.scene.add(this.axisGroup);

    this.createAxes();
    this.createAxisLabels(widgetContainer);
    this.setupClickHandlers(widgetContainer);
  }

  private createAxes() {
    const axisLength = 1.2;
    const arrowSize = 0.15;

    // X축 (빨강)
    const xAxis = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0xff4444,
      arrowSize,
      arrowSize * 0.6
    );
    this.axisGroup.add(xAxis);

    // Y축 (초록)
    const yAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0x44ff44,
      arrowSize,
      arrowSize * 0.6
    );
    this.axisGroup.add(yAxis);

    // Z축 (파랑)
    const zAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      axisLength,
      0x4444ff,
      arrowSize,
      arrowSize * 0.6
    );
    this.axisGroup.add(zAxis);

    // 원점 구
    const originSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.axisGroup.add(originSphere);
  }

  private createAxisLabels(widgetContainer: HTMLElement) {
    const labelData = [
      { axis: 'X', color: '#ff4444', position: new THREE.Vector3(1.5, 0, 0), direction: 'right' as const },
      { axis: 'Y', color: '#44ff44', position: new THREE.Vector3(0, 1.5, 0), direction: 'top' as const },
      { axis: 'Z', color: '#4444ff', position: new THREE.Vector3(0, 0, 1.5), direction: 'front' as const },
      { axis: '-X', color: '#ff4444', position: new THREE.Vector3(-1.5, 0, 0), direction: 'left' as const },
      { axis: '-Y', color: '#44ff44', position: new THREE.Vector3(0, -1.5, 0), direction: 'bottom' as const },
      { axis: '-Z', color: '#4444ff', position: new THREE.Vector3(0, 0, -1.5), direction: 'back' as const },
    ];

    for (const data of labelData) {
      const label = document.createElement('div');
      label.textContent = data.axis;
      label.dataset.direction = data.direction;
      label.style.cssText = `
        position: absolute;
        color: ${data.color};
        font-size: 12px;
        font-weight: bold;
        font-family: monospace;
        cursor: pointer;
        user-select: none;
        text-shadow: 0 0 3px rgba(0,0,0,0.8);
        padding: 2px 4px;
        border-radius: 3px;
        transition: background 0.2s;
      `;
      label.addEventListener('mouseenter', () => {
        label.style.background = 'rgba(255,255,255,0.2)';
      });
      label.addEventListener('mouseleave', () => {
        label.style.background = 'transparent';
      });
      widgetContainer.appendChild(label);

      this.labels.push({
        element: label,
        axis: data.axis,
        direction: data.axis.startsWith('-') ? -1 : 1
      });
    }
  }

  private setupClickHandlers(widgetContainer: HTMLElement) {
    widgetContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const direction = target.dataset.direction as 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | undefined;

      if (direction) {
        this.cameraController.lookAt(direction);
      }
    });
  }

  update() {
    // 메인 카메라의 회전을 따라감
    this.axisGroup.quaternion.copy(this.mainCamera.quaternion).invert();

    // 라벨 위치 업데이트
    const labelPositions = [
      new THREE.Vector3(1.5, 0, 0),
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(0, 0, 1.5),
      new THREE.Vector3(-1.5, 0, 0),
      new THREE.Vector3(0, -1.5, 0),
      new THREE.Vector3(0, 0, -1.5),
    ];

    for (let i = 0; i < this.labels.length; i++) {
      const pos = labelPositions[i].clone();
      pos.applyQuaternion(this.axisGroup.quaternion);

      // 화면 좌표로 변환
      const screenPos = pos.clone().project(this.camera);
      const x = (screenPos.x * 0.5 + 0.5) * 100;
      const y = (-screenPos.y * 0.5 + 0.5) * 100;

      this.labels[i].element.style.left = `${x - 10}px`;
      this.labels[i].element.style.top = `${y - 8}px`;

      // Z값에 따라 투명도 조절 (뒤에 있는 라벨은 흐리게)
      const opacity = pos.z > 0 ? 1 : 0.3;
      this.labels[i].element.style.opacity = String(opacity);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// LocalStorage keys
const STORAGE_KEYS = {
  assetsPath: 'unity-quarks-assets-path',
  selectedPrefab: 'unity-quarks-selected-prefab',
  currentDir: 'unity-quarks-current-dir',
  logHeight: 'unity-quarks-log-height',
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
let cameraController: UnityCameraController;
let batchRenderer: BatchedParticleRenderer;
let particleSystems: ParticleSystem[] = [];
let viewCubeWidget: ViewCubeWidget;

// FPS 계산용
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
let statsElement: HTMLDivElement | null = null;

// Log counts
let logCounts = { all: 0, info: 0, warning: 0, error: 0 };

// Log filter state
let logFilters = { info: true, warning: true, error: true };

// DOM Elements
const assetsPathInput = document.getElementById('assets-path') as HTMLInputElement;
const fileTree = document.getElementById('file-tree') as HTMLDivElement;
const previewInfo = document.getElementById('preview-info') as HTMLDivElement;
const logContent = document.getElementById('log-content') as HTMLElement;
const logCountAll = document.getElementById('log-count-all') as HTMLElement;
const logCountInfo = document.getElementById('log-count-info') as HTMLElement;
const logCountWarning = document.getElementById('log-count-warning') as HTMLElement;
const logCountError = document.getElementById('log-count-error') as HTMLElement;
const logClearBtn = document.getElementById('log-clear') as HTMLButtonElement;
const logResizeHandle = document.getElementById('log-resize') as HTMLDivElement;
const logFooter = document.getElementById('log') as HTMLElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const btnConvert = document.getElementById('btn-convert') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const conversionPanel = document.getElementById('conversion-panel') as HTMLDivElement;
const conversionContent = document.getElementById('conversion-content') as HTMLDivElement;
const conversionToggle = document.getElementById('conversion-toggle') as HTMLButtonElement;

// Initialize
init();

async function init() {
  initThreeJS();
  initEventListeners();
  initLogPanel();
  initConversionPanel();
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

  // Unity-style Camera Controller
  cameraController = new UnityCameraController(camera, renderer.domElement);

  // ViewCube Widget (3D 좌표계)
  viewCubeWidget = new ViewCubeWidget(container, camera, cameraController);

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

    // 파일명 span
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    nameSpan.style.flex = '1';
    div.appendChild(nameSpan);

    // Prefab인 경우 경로 복사 버튼 추가
    if (item.isPrefab) {
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋';
      copyBtn.title = '경로 복사';
      copyBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0 4px; font-size: 12px; opacity: 0.6;';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.path).then(() => {
          log(`경로 복사됨: ${item.path}`, 'success');
          copyBtn.textContent = '✓';
          setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
        });
      });
      div.appendChild(copyBtn);
    }

    // 저장된 prefab이면 선택 표시
    if (item.path === selectedPrefab) {
      div.classList.add('selected');
    }

    if (item.isDirectory) {
      div.addEventListener('click', () => loadDirectory(item.path));
    } else if (item.isPrefab) {
      div.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
          selectPrefab(item.path, div);
        }
      });
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

    // 서버 로그 표시
    if (data.logs && Array.isArray(data.logs)) {
      for (const logEntry of data.logs) {
        log(logEntry.message, logEntry.type as 'info' | 'warning' | 'error');
      }
    }

    if (data.error) {
      throw new Error(data.error);
    }

    currentQuarksJson = data.quarksJson;
    const psCount = data.quarksJson?.particleSystems?.length || 0;
    previewInfo.textContent = `파티클 시스템: ${psCount}개`;

    // 변환 정보 패널 업데이트
    if (data.conversionInfo) {
      updateConversionPanel(data.conversionInfo);
    }

    // Load into three.js (텍스처 정보 및 Material 정보 포함)
    await loadParticlePreview(data.quarksJson, data.textures, data.materialInfo);

    log('미리보기 로드 완료', 'success');
  } catch (error) {
    log(`미리보기 실패: ${error}`, 'error');
    previewInfo.textContent = `오류: ${error}`;
  }
}

// Material 정보 타입
interface MaterialInfo {
  blendMode: {
    srcBlend: number;
    dstBlend: number;
    zWrite: number;
  };
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  shaderName: string;
}

async function loadParticlePreview(quarksJson: unknown, textureUrls?: string[], materialInfo?: MaterialInfo | null) {
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
      const ps = createParticleSystemFromData(psData, loadedTexture, materialInfo);
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

function createParticleSystemFromData(data: Record<string, unknown>, texture?: THREE.Texture | null, materialInfo?: MaterialInfo | null): ParticleSystem | null {
  try {
    const duration = (data.duration as number) || 5;
    const looping = (data.looping as boolean) ?? true;

    // Shape 생성
    let shape;
    const shapeData = data.shape as Record<string, unknown> | undefined;
    // Shape rotation 정보 추출 (Unity degree → Three.js radian 변환)
    const shapeRotation = shapeData?.rotation as { x: number; y: number; z: number } | undefined;
    // Shape position offset 추출
    const shapePosition = shapeData?.position as { x: number; y: number; z: number } | undefined;

    if (shapeData) {
      const shapeType = shapeData.type as string;
      const radius = (shapeData.radius as number) || 1;
      // Unity radiusThickness: 0 = surface, 1 = volume
      // three.quarks thickness: 같은 의미 (0~1 범위)
      const thickness = (shapeData.thickness as number) ?? 1;

      switch (shapeType) {
        case 'cone':
          shape = new ConeEmitter({
            radius: radius,
            angle: (shapeData.angle as number) || 0.5,
            arc: (shapeData.arc as number) || Math.PI * 2,
            thickness: thickness,
          });
          break;
        case 'sphere':
          shape = new SphereEmitter({ radius: radius, thickness: thickness });
          break;
        case 'hemisphere':
          shape = new HemisphereEmitter({ radius: radius, thickness: thickness });
          break;
        case 'donut':
          shape = new DonutEmitter({
            radius: radius,
            donutRadius: (shapeData.donutRadius as number) || radius * 0.2,
            arc: (shapeData.arc as number) || Math.PI * 2,
            thickness: thickness,
          });
          break;
        case 'circle':
          shape = new CircleEmitter({
            radius: radius,
            arc: (shapeData.arc as number) || Math.PI * 2,
            thickness: thickness,
          });
          break;
        case 'box':
          // Box는 3D지만 RectangleEmitter는 2D - X, Y 축만 사용
          const boxScale = shapeData.scale as { x: number; y: number; z: number } | undefined;
          shape = new RectangleEmitter({
            width: boxScale?.x || 1,
            height: boxScale?.y || 1,
          });
          break;
        case 'edge':
          // Edge는 선형 발산 - RectangleEmitter로 근사 (height=0)
          const edgeRadius = (shapeData.radius as number) || 1;
          shape = new RectangleEmitter({
            width: edgeRadius * 2, // radius는 반쪽 길이이므로 2배
            height: 0.001, // 거의 0에 가깝게
          });
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

    // StartSize 값 생성 (3D 또는 일반)
    const startSize3DData = data.startSize3D as { x: Record<string, unknown>; y: Record<string, unknown>; z: Record<string, unknown> } | undefined;
    const startSizeData = data.startSize as Record<string, unknown> | undefined;
    let startSize;

    if (startSize3DData) {
      // 3D 크기 사용
      const createValueGen = (d: Record<string, unknown> | undefined) => {
        if (d?.type === 'interval') {
          return new IntervalValue((d.min as number) || 0.1, (d.max as number) || 1);
        }
        return new ConstantValue((d?.value as number) || 1);
      };
      startSize = new Vector3Function(
        createValueGen(startSize3DData.x),
        createValueGen(startSize3DData.y),
        createValueGen(startSize3DData.z)
      );
      console.log('StartSize3D 적용:', startSize3DData);
    } else if (startSizeData?.type === 'interval') {
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

    // StartRotation 값 생성 (3D 또는 일반)
    const startRotation3DData = data.startRotation3D as { x: Record<string, unknown>; y: Record<string, unknown> } | undefined;
    const startRotationData = data.startRotation as Record<string, unknown> | undefined;
    let startRotation;

    if (startRotation3DData) {
      // 3D 회전 사용 (EulerGenerator)
      const createValueGen = (d: Record<string, unknown> | undefined) => {
        if (d?.type === 'interval') {
          return new IntervalValue((d.min as number) || 0, (d.max as number) || 0);
        }
        return new ConstantValue((d?.value as number) || 0);
      };
      // Unity Z rotation은 일반 startRotation에 저장됨
      startRotation = new EulerGenerator(
        createValueGen(startRotation3DData.x),
        createValueGen(startRotation3DData.y),
        createValueGen(startRotationData)
      );
      console.log('StartRotation3D 적용:', startRotation3DData);
    } else if (startRotationData?.type === 'interval') {
      startRotation = new IntervalValue(
        (startRotationData.min as number) || 0,
        (startRotationData.max as number) || Math.PI * 2
      );
    } else {
      startRotation = new ConstantValue((startRotationData?.value as number) || 0);
    }

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

    // RateOverDistance
    const rateOverDistanceData = emissionData?.rateOverDistance as Record<string, unknown> | undefined;
    let emissionOverDistance;
    if (rateOverDistanceData?.type === 'interval') {
      emissionOverDistance = new IntervalValue(
        (rateOverDistanceData.min as number) || 0,
        (rateOverDistanceData.max as number) || 0
      );
    } else {
      emissionOverDistance = new ConstantValue((rateOverDistanceData?.value as number) || 0);
    }

    // Emission Bursts
    const burstsData = emissionData?.bursts as Array<Record<string, unknown>> | undefined;
    const emissionBursts = burstsData?.map(b => {
      const countData = b.count as Record<string, unknown> | undefined;
      let count;
      if (countData?.type === 'interval') {
        count = new IntervalValue(
          (countData.min as number) || 1,
          (countData.max as number) || 10
        );
      } else {
        count = new ConstantValue((countData?.value as number) || 10);
      }
      return {
        time: (b.time as number) || 0,
        count,
        cycle: (b.cycles as number) || 1,
        interval: (b.interval as number) || 0.1,
        probability: (b.probability as number) || 1,
      };
    }) || [];

    // Material 생성 (전달된 텍스처와 Material 정보 사용)
    if (!texture) {
      throw new Error('텍스처가 없습니다');
    }

    // Material Color 적용 (HDR 지원)
    let finalR = r, finalG = g, finalB = b;
    if (materialInfo?.color) {
      // Material Color를 파티클 색상에 곱함 (HDR 색상 지원)
      finalR *= materialInfo.color.r;
      finalG *= materialInfo.color.g;
      finalB *= materialInfo.color.b;
      console.log('Material Color 적용:', materialInfo.color);
    }

    console.log('최종 Material 색상:', { r: finalR, g: finalG, b: finalB });

    // Unity BlendMode → Three.js BlendMode 변환
    // Unity: 0=Zero, 1=One, 5=SrcAlpha, 10=OneMinusSrcAlpha
    // Common combinations:
    // - Additive: SrcAlpha(5) + One(1)
    // - Alpha Blend: SrcAlpha(5) + OneMinusSrcAlpha(10)
    let blending = THREE.AdditiveBlending; // 기본값
    let depthWrite = false;

    if (materialInfo?.blendMode) {
      const { srcBlend, dstBlend, zWrite } = materialInfo.blendMode;
      console.log('Unity BlendMode:', { srcBlend, dstBlend, zWrite });

      // SrcAlpha + OneMinusSrcAlpha = Normal Alpha Blending
      if (srcBlend === 5 && dstBlend === 10) {
        blending = THREE.NormalBlending;
        console.log('BlendMode: NormalBlending (Alpha)');
      }
      // SrcAlpha + One = Additive
      else if (srcBlend === 5 && dstBlend === 1) {
        blending = THREE.AdditiveBlending;
        console.log('BlendMode: AdditiveBlending');
      }
      // One + One = Additive
      else if (srcBlend === 1 && dstBlend === 1) {
        blending = THREE.AdditiveBlending;
        console.log('BlendMode: AdditiveBlending (One+One)');
      }
      // One + OneMinusSrcAlpha = Premultiplied Alpha
      else if (srcBlend === 1 && dstBlend === 10) {
        blending = THREE.NormalBlending;
        console.log('BlendMode: NormalBlending (Premultiplied)');
      }

      depthWrite = zWrite === 1;
    }

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color(Math.min(finalR, 1), Math.min(finalG, 1), Math.min(finalB, 1)),
      transparent: true,
      blending,
      side: THREE.DoubleSide,
      depthWrite,
    });

    // Texture Sheet Animation 데이터
    const tsaData = data.textureSheetAnimation as Record<string, unknown> | undefined;
    const hasTSA = tsaData?.enabled === true;
    const tilesX = hasTSA ? (tsaData.tilesX as number) || 1 : 1;
    const tilesY = hasTSA ? (tsaData.tilesY as number) || 1 : 1;

    console.log('Texture Sheet Animation:', { enabled: hasTSA, tilesX, tilesY });

    const speedFactor = (data.speedFactor as number) || 1;

    const ps = new ParticleSystem({
      duration,
      looping,
      startLife,
      startSpeed,
      startSize,
      startRotation,
      startColor,
      worldSpace: (data.worldSpace as boolean) ?? true,
      maxParticle: (data.maxParticles as number) || 1000,
      emissionOverTime,
      emissionOverDistance,
      emissionBursts: emissionBursts.length > 0 ? emissionBursts : undefined,
      shape,
      material,
      renderMode: 0, // Billboard
      renderOrder: 0,
      uTileCount: tilesX,
      vTileCount: tilesY,
      startTileIndex: new ConstantValue(0),
      speedFactor,
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

    // Shape rotation 적용 (Unity degree → Three.js radian)
    // emitter는 Object3D이므로 rotation을 직접 설정할 수 있음
    if (shapeRotation) {
      const degToRad = Math.PI / 180;
      ps.emitter.rotation.set(
        shapeRotation.x * degToRad,
        shapeRotation.y * degToRad,
        shapeRotation.z * degToRad
      );
      console.log('Shape rotation 적용:', shapeRotation);
    }

    // Shape position offset 적용
    if (shapePosition) {
      ps.emitter.position.set(
        shapePosition.x,
        shapePosition.y,
        shapePosition.z
      );
      console.log('Shape position 적용:', shapePosition);
    }

    // StartDelay 처리
    const startDelay = (data.startDelay as number) || 0;
    if (startDelay > 0) {
      ps.pause();
      setTimeout(() => {
        ps.play();
        console.log(`StartDelay ${startDelay}s 후 재생 시작`);
      }, startDelay * 1000);
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
    case 'ApplyForce': {
      const direction = behavior.direction as { x: number; y: number; z: number } | undefined;
      const magnitude = behavior.magnitude as number | undefined;
      if (direction && magnitude !== undefined) {
        ps.addBehavior(
          new ApplyForce(
            new THREE.Vector3(direction.x, direction.y, direction.z),
            new ConstantValue(magnitude)
          )
        );
        console.log('ApplyForce behavior 추가됨:', direction, magnitude);
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

function log(message: string, type?: 'error' | 'success' | 'warning' | 'info') {
  // 스크롤이 하단에 있는지 확인 (새 로그 추가 전에 확인)
  const isAtBottom = logContent.scrollHeight - logContent.scrollTop - logContent.clientHeight < 10;

  const entry = document.createElement('div');
  const logType = type || 'info';
  entry.className = `log-entry ${logType}`;
  entry.dataset.type = logType;

  // Icon
  const icon = document.createElement('span');
  icon.className = 'log-icon';
  switch (logType) {
    case 'error':
      icon.textContent = '❌';
      break;
    case 'warning':
      icon.textContent = '⚠️';
      break;
    case 'success':
      icon.textContent = '✅';
      entry.dataset.type = 'info'; // success는 info로 분류
      break;
    default:
      icon.textContent = 'ℹ️';
  }

  // Time
  const time = document.createElement('span');
  time.className = 'log-time';
  const now = new Date();
  time.textContent = `[${now.toLocaleTimeString()}]`;

  // Message
  const msg = document.createElement('span');
  msg.className = 'log-message';
  msg.textContent = message;

  entry.appendChild(icon);
  entry.appendChild(time);
  entry.appendChild(msg);

  logContent.appendChild(entry);

  // 스크롤이 하단에 있었을 때만 자동 스크롤
  if (isAtBottom) {
    logContent.scrollTop = logContent.scrollHeight;
  }

  // Update counts
  logCounts.all++;
  if (logType === 'error') logCounts.error++;
  else if (logType === 'warning') logCounts.warning++;
  else logCounts.info++;

  updateLogCounts();
  applyLogFilters();
}

function updateLogCounts() {
  logCountAll.textContent = String(logCounts.all);
  logCountInfo.textContent = String(logCounts.info);
  logCountWarning.textContent = String(logCounts.warning);
  logCountError.textContent = String(logCounts.error);
}

function applyLogFilters() {
  const entries = logContent.querySelectorAll('.log-entry');
  entries.forEach(entry => {
    const el = entry as HTMLElement;
    const type = el.dataset.type || 'info';

    if (type === 'info' && !logFilters.info) {
      el.classList.add('hidden');
    } else if (type === 'warning' && !logFilters.warning) {
      el.classList.add('hidden');
    } else if (type === 'error' && !logFilters.error) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  });
}

function clearLogs() {
  logContent.innerHTML = '';
  logCounts = { all: 0, info: 0, warning: 0, error: 0 };
  updateLogCounts();
  log('로그 지워짐');
}

function initLogPanel() {
  // 저장된 높이 복원
  const savedHeight = localStorage.getItem(STORAGE_KEYS.logHeight);
  if (savedHeight) {
    const height = parseInt(savedHeight, 10);
    if (height >= 80 && height <= 600) {
      logFooter.style.height = `${height}px`;
    }
  }

  // Clear button
  logClearBtn.addEventListener('click', clearLogs);

  // Filter buttons
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter;
      if (filter === 'all') {
        // Toggle all
        const allActive = Object.values(logFilters).every(v => v);
        logFilters = { info: !allActive, warning: !allActive, error: !allActive };
        document.querySelectorAll('.log-filter-btn').forEach(b => {
          if (allActive) {
            b.classList.remove('active');
          } else {
            b.classList.add('active');
          }
        });
      } else if (filter) {
        logFilters[filter as keyof typeof logFilters] = !logFilters[filter as keyof typeof logFilters];
        btn.classList.toggle('active');

        // Update "all" button state
        const allActive = Object.values(logFilters).every(v => v);
        const allBtn = document.querySelector('.log-filter-btn[data-filter="all"]');
        if (allActive) {
          allBtn?.classList.add('active');
        } else {
          allBtn?.classList.remove('active');
        }
      }
      applyLogFilters();
    });
  });

  // Resize handle
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  logResizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startY = e.clientY;
    startHeight = logFooter.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    // 드래그 중 iframe 등의 포인터 이벤트 차단
    document.body.style.pointerEvents = 'none';
    logResizeHandle.style.pointerEvents = 'auto';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    e.preventDefault();

    const delta = startY - e.clientY;
    const newHeight = Math.max(80, Math.min(600, startHeight + delta));
    logFooter.style.height = `${newHeight}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      logResizeHandle.style.pointerEvents = '';

      // 높이 저장
      const currentHeight = logFooter.offsetHeight;
      localStorage.setItem(STORAGE_KEYS.logHeight, String(currentHeight));
    }
  });
}

// 변환 정보 타입
interface ConversionDetail {
  module: string;
  unity: string;
  quarks: string;
  status: 'ok' | 'partial' | 'unsupported';
  note?: string;
}

interface ParticleSystemConversionInfo {
  name: string;
  details: ConversionDetail[];
}

function initConversionPanel() {
  conversionToggle.addEventListener('click', () => {
    conversionPanel.classList.add('hidden');
  });
}

function updateConversionPanel(info: ParticleSystemConversionInfo[]) {
  conversionPanel.classList.remove('hidden');

  // 통계 계산
  let totalOk = 0, totalPartial = 0, totalUnsupported = 0;
  for (const ps of info) {
    for (const d of ps.details) {
      if (d.status === 'ok') totalOk++;
      else if (d.status === 'partial') totalPartial++;
      else if (d.status === 'unsupported') totalUnsupported++;
    }
  }

  let html = `<div style="padding: 8px 12px; background: #1a1a2e; border-bottom: 1px solid #333;">
    <span class="status-ok">✓ ${totalOk}</span> &nbsp;
    <span class="status-partial">◐ ${totalPartial}</span> &nbsp;
    <span class="status-unsupported">✗ ${totalUnsupported}</span>
  </div>`;

  for (const ps of info) {
    html += `<div class="conversion-system">
      <div class="conversion-system-header">${ps.name}</div>
      <table class="conversion-table">
        <thead>
          <tr>
            <th>모듈</th>
            <th>Unity</th>
            <th>Quarks</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>`;

    for (const detail of ps.details) {
      const statusIcon = detail.status === 'ok' ? '✓' :
                        detail.status === 'partial' ? '◐' : '✗';
      const statusClass = `status-${detail.status}`;

      html += `<tr>
        <td class="module">${detail.module}</td>
        <td class="unity">${detail.unity}</td>
        <td class="quarks">${detail.quarks}</td>
        <td class="${statusClass}">${statusIcon}</td>
      </tr>`;

      if (detail.note) {
        html += `<tr>
          <td colspan="4" class="conversion-note">⚠️ ${detail.note}</td>
        </tr>`;
      }
    }

    html += `</tbody></table></div>`;
  }

  conversionContent.innerHTML = html;
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

  cameraController.update(delta);
  viewCubeWidget.update();
  renderer.render(scene, camera);
}
