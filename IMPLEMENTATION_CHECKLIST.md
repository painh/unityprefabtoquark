# Unity Prefab → three.quarks 변환 구현 체크리스트

MasterStylizedFX 프리팹 분석 결과를 바탕으로 작성된 구현 우선순위 체크리스트입니다.

---

## 🔥 최우선 (Critical) - 대부분의 프리팹에서 사용됨

### Shape 모듈
- [x] **Shape.Rotation 지원** - 파티클 방향 제어 (특히 X: -90° 회전이 빈번함) ✅ 완료
- [ ] **Shape type=4 (Mesh) 지원** - three.quarks에 MeshSurfaceEmitter 있음, Unity Mesh 로드 필요 (복잡)
- [x] **radiusThickness** - Cone/Sphere의 표면 vs 볼륨 발산 (0=표면, 1=볼륨) ✅ 완료
- [x] **randomDirectionAmount** - 발산 방향 랜덤화 (spread로 변환) ✅ 완료
- [ ] **sphericalDirectionAmount** - 구형 방향 보정

### Color 모듈
- [x] **Alpha Gradient 분리 파싱** - atime0~7 값을 별도 처리 (현재 color key만 파싱됨) ✅ 완료
- [x] **m_NumAlphaKeys 활용** - 알파 키 개수 정확히 파싱 ✅ 완료

---

## ⚡ 높음 (High) - 많은 프리팹에서 사용됨

### Main 모듈
- [x] **startDelay** - 파티클 시스템 시작 지연 (상수값, setTimeout 처리) ✅ 완료
- [x] **startSize3D** - X/Y/Z 별도 크기 (Vector3Function) ✅ 완료
- [x] **startRotation3D** - X/Y/Z 별도 회전 (EulerGenerator) ✅ 완료
- [x] **gravityModifier** - 중력 영향도 (ApplyForce로 변환) ✅ 완료
- [x] **simulationSpeed** - 시뮬레이션 속도 배율 (speedFactor) ✅ 완료

### Size Over Lifetime
- [x] **Separate Axes 모드** - X/Y/Z 축별 크기 커브 분리 (Vector3Function) ✅ 완료

### Velocity Over Lifetime
- [x] **Space 설정** - Local(0) vs World(1) 좌표계 구분 (로깅) ✅ 완료
- [ ] **Orbital Velocity** - x/y/z 축 공전 속도
- [ ] **Radial Velocity** - 방사형 속도

### Rotation Over Lifetime
- [ ] **Separate Axes 모드** - X/Y/Z 축별 회전 커브 분리 (three.quarks RotationOverLife가 Vector3 미지원)

---

## 📌 보통 (Medium) - 일부 프리팹에서 사용됨

### Shape 모듈
- [x] **Shape type=12 (Donut)** - 도넛 형태 발산 ✅ 완료
- [x] **Shape type=8 (Edge)** - 선형 발산 (RectangleEmitter로 근사) ✅ 완료
- [ ] **Shape type=5 (MeshRenderer)** - 메시 렌더러 기반 발산
- [x] **Arc 설정** - Cone/Circle/Donut의 호 각도 (arc 기본 지원) ✅ 완료
- [x] **Position 오프셋** - 발산 위치 오프셋 (emitter.position) ✅ 완료

### Texture Sheet Animation
- [x] **Animation SingleRow 모드** - rowMode=1일 때 단일 행 애니메이션 ✅ 완료
- [x] **rowIndex** - 특정 행 선택 ✅ 완료
- [ ] **UV Channel Select** - 텍스처 좌표 채널 선택
- [ ] **speedRange** - 애니메이션 속도 범위

### Renderer
- [ ] **Multi-texture 지원** - 여러 Material 사용 시
- [x] **renderMode** - Billboard(0), Stretch(1), HorizontalBillboard(2), VerticalBillboard(3), Mesh(4) ✅ 완료
- [ ] **sortMode** - 파티클 정렬 방식
- [x] **lengthScale/velocityScale** - Stretch 모드 설정 ✅ 완료

### Emission
- [x] **Burst 세부 설정** - cycleCount, repeatInterval, probability ✅ 완료
- [x] **rateOverDistance** - 거리 기반 발산 ✅ 완료

---

## 💤 낮음 (Low) - 특수 효과에서만 사용됨

### 고급 모듈
- [ ] **Collision 모듈** - 충돌 처리
- [x] **Trails 모듈** - 파티클 궤적 (RenderMode.Trail, TrailSettings) ✅ 완료
- [ ] **Sub Emitters** - 하위 파티클 시스템
- [x] **Noise 모듈** - 노이즈 기반 움직임 ✅ 완료
- [ ] **Lights 모듈** - 파티클 라이트
- [x] **Force Over Lifetime** - 힘 적용 (ApplyForce) ✅ 완료
- [ ] **Limit Velocity Over Lifetime** - 속도 제한
- [ ] **Inherit Velocity** - 부모 속도 상속
- [ ] **Lifetime By Emitter Speed** - 발산 속도에 따른 수명

### 커브/그라디언트 개선
- [ ] **TwoCurves 모드 (minMaxState=2)** - 두 커브 사이 보간 (three.quarks 미지원, maxCurve만 사용)
- [x] **TwoConstants 모드 (minMaxState=3)** - 두 상수 사이 랜덤 ✅ 완료 (IntervalValue)
- [ ] **Gradient Mode** - Fixed(0) vs Blend(1)

---

## 📊 분석 통계

### Shape Type 사용 빈도 (분석된 프리팹 기준)
| Type | 이름 | 사용 빈도 | 지원 상태 |
|------|------|----------|----------|
| 4 | Mesh | ████████ 가장 높음 | ❌ 미지원 |
| 2 | Cone | ████ 높음 | ✅ 지원 |
| 0 | Sphere | ███ 중간 | ✅ 지원 |
| 12 | Donut | ██ 낮음 | ✅ 지원 |
| 5 | MeshRenderer | █ 드묾 | ❌ 미지원 |

### 모듈 활성화 빈도
| 모듈 | 사용 빈도 | 지원 상태 |
|------|----------|----------|
| ColorOverLifetime | 90%+ | ✅ 지원 (알파 분리 파싱 완료) |
| SizeOverLifetime | 80%+ | ⚠️ 부분 지원 (Separate Axes 미지원) |
| TextureSheetAnimation | 70%+ | ⚠️ 부분 지원 |
| RotationOverLifetime | 50%+ | ⚠️ 부분 지원 |
| VelocityOverLifetime | 30%+ | ⚠️ 부분 지원 |

---

## 구현 진행 상황

### 완료된 항목
- [x] 기본 Shape 타입 (Sphere, Cone, Box, Circle, Hemisphere, Donut, Edge)
- [x] Main 모듈 기본 속성 (duration, loop, startLifetime, startSpeed, startSize, startColor)
- [x] Main 모듈 고급 속성 (startDelay, startSize3D, startRotation3D, gravityModifier, simulationSpeed)
- [x] Emission rateOverTime, rateOverDistance
- [x] Emission Burst (cycles, interval, probability)
- [x] ColorOverLifetime 기본 그라디언트
- [x] SizeOverLifetime 기본 커브 + Separate Axes
- [x] TextureSheetAnimation (tilesX, tilesY, SingleRow 모드, rowIndex)
- [x] MinMaxCurve Constant/Curve/TwoConstants 모드
- [x] Shape.Rotation - Emitter Object3D에 회전 적용
- [x] Shape.Position - Emitter 위치 오프셋
- [x] Alpha Gradient - Color/Alpha 키 분리 파싱 및 보간
- [x] radiusThickness - Sphere/Cone/Circle/Donut thickness 지원
- [x] randomDirectionAmount - spread로 변환
- [x] Arc 설정 - Cone/Circle/Donut 호 각도
- [x] Trails 모듈 - RenderMode.Trail + TrailSettings

### 미지원 (three.quarks 한계)
- [ ] TwoCurves 모드 - 두 커브 사이 랜덤
- [ ] Rotation Over Lifetime Separate Axes - Vector3 미지원
- [ ] Orbital/Radial Velocity - 미지원
- [ ] Shape type=4 (Mesh), type=5 (MeshRenderer) - 메시 로드 복잡

---

## 참고: 분석된 프리팹 목록
- SmallFireBulletHit.prefab
- ToonExplosion.prefab
- SimpleSphereExplosion.prefab
- SphereConfetti.prefab
- GreenTornado.prefab
- PurpleCharge.prefab
- GreenFlameThrower.prefab
- VerticalLightningGreen.prefab
- LightingBall2.prefab
- PurpleShield.prefab
- GreenNukeExplosion.prefab
- 기타 MasterStylizedFX 폴더 내 프리팹들
