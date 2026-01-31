# Unity Prefab to three.quarks Converter

Unity ParticleSystem Prefab 파일을 [three.quarks](https://github.com/Alchemist0823/three.quarks) 라이브러리 형식으로 변환하는 도구입니다.

## Features

- Unity Prefab 파일 (.prefab) 파싱
- ParticleSystem 모듈 변환:
  - Main Module (duration, looping, startLifetime, startSpeed, startSize, startColor 등)
  - Emission Module (rateOverTime, bursts)
  - Shape Module (Sphere, Hemisphere, Cone, Box, Circle 등)
  - Color Over Lifetime
  - Size Over Lifetime
  - Rotation Over Lifetime
  - Texture Sheet Animation
- Material/Texture 자동 추출 (GUID 기반 .meta 파일 추적)
- Three.js 기반 실시간 미리보기
- JSON 형식으로 변환 결과 저장

## Tech Stack

- **Frontend**: TypeScript, Three.js, three.quarks, Vite
- **Backend**: Node.js, Express, TypeScript
- **Parser**: YAML (Unity Prefab 형식)

## Installation

```bash
# 저장소 클론
git clone https://github.com/painh/unityprefabtoquark.git
cd unityprefabtoquark

# 의존성 설치
npm install
```

## Usage

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:5173 접속

### 사용 방법

1. **Assets 경로 입력**: Unity 프로젝트의 Assets 폴더 경로를 입력하고 Enter
2. **Prefab 선택**: 파일 트리에서 변환할 .prefab 파일 클릭
3. **미리보기 확인**: 우측 뷰포트에서 변환된 파티클 시스템 확인
4. **저장**: Convert 버튼 클릭 후 출력 경로 지정

### 프로젝트 빌드

```bash
npm run build
```

## Project Structure

```
src/
├── client/
│   └── main.ts          # Three.js 미리보기 & UI
├── server/
│   └── index.ts         # Express API 서버
├── parser/
│   ├── unity-yaml.ts    # Unity YAML 파서
│   └── asset-resolver.ts # GUID → 에셋 경로 변환
└── converter/
    └── particle-converter.ts # ParticleSystem → three.quarks 변환
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/browse` | GET | 폴더 내용 조회 |
| `/api/prefab` | GET | Prefab 파일 파싱 |
| `/api/preview` | GET | 변환된 JSON 미리보기 |
| `/api/convert` | POST | Prefab 변환 및 저장 |
| `/api/texture` | GET | 텍스처 파일 서빙 |

## Limitations

- Unity 2019+ Prefab 형식 지원
- 일부 고급 ParticleSystem 기능은 근사치로 변환됨:
  - Curve 타입은 Bezier로 근사
  - Velocity Over Lifetime은 ApplyForce로 대체
  - Sub Emitters, Trails 등은 미지원

## License

MIT
