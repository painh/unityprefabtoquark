import * as THREE from 'three';

/**
 * CartoonCoffee/Particle Basic Material
 * Unity Amplify Shader Editor에서 변환됨
 *
 * 지원 기능:
 * - UV Distort: 노이즈 기반 UV 왜곡
 * - UV Scroll: UV 스크롤 애니메이션
 * - Custom Fade: 커스텀 페이드 마스크
 * - Split Toning: 하이라이트/섀도우 색상 분리
 * - Black Tint: 어두운 부분 틴팅
 * - Alpha Tint: 알파 기반 틴팅
 * - Adjust Color: HSV 조정
 * - Cutout Fade: 컷아웃 페이드
 */

export interface CartoonCoffee_Particle_BasicUniforms {
  // 기본 텍스처
  map: THREE.IUniform<THREE.Texture | null>;
  noiseTexture: THREE.IUniform<THREE.Texture | null>;
  time: THREE.IUniform<number>;

  // Tint Color (기본 파티클 색상)
  tintColor: THREE.IUniform<THREE.Vector4>;

  // UV Distort
  enableUVDistort: THREE.IUniform<boolean>;
  uvDistortFrom: THREE.IUniform<THREE.Vector2>;
  uvDistortTo: THREE.IUniform<THREE.Vector2>;
  uvDistortSpeed: THREE.IUniform<THREE.Vector2>;
  uvDistortNoiseScale: THREE.IUniform<THREE.Vector2>;
  uvDistortFade: THREE.IUniform<number>;

  // UV Scroll
  enableUVScroll: THREE.IUniform<boolean>;
  uvScrollSpeed: THREE.IUniform<THREE.Vector2>;

  // Custom Fade
  enableCustomFade: THREE.IUniform<boolean>;
  customFadeMask: THREE.IUniform<THREE.Texture | null>;
  customFadeNoiseScale: THREE.IUniform<THREE.Vector2>;
  customFadeNoiseFactor: THREE.IUniform<number>;
  customFadeSmoothness: THREE.IUniform<number>;
  customFadeAlpha: THREE.IUniform<number>;

  // Split Toning
  enableSplitToning: THREE.IUniform<boolean>;
  splitToningHighlightsColor: THREE.IUniform<THREE.Vector4>;
  splitToningShadowsColor: THREE.IUniform<THREE.Vector4>;
  splitToningShift: THREE.IUniform<number>;
  splitToningBalance: THREE.IUniform<number>;
  splitToningContrast: THREE.IUniform<number>;
  splitToningFade: THREE.IUniform<number>;

  // Black Tint
  enableBlackTint: THREE.IUniform<boolean>;
  blackTintColor: THREE.IUniform<THREE.Vector4>;
  blackTintPower: THREE.IUniform<number>;
  blackTintFade: THREE.IUniform<number>;

  // Alpha Tint
  enableAlphaTint: THREE.IUniform<boolean>;
  alphaTintColor: THREE.IUniform<THREE.Vector4>;
  alphaTintPower: THREE.IUniform<number>;
  alphaTintFade: THREE.IUniform<number>;
  alphaTintMinAlpha: THREE.IUniform<number>;

  // Adjust Color
  enableAdjustColor: THREE.IUniform<boolean>;
  adjustColorHueShift: THREE.IUniform<number>;
  adjustColorSaturation: THREE.IUniform<number>;
  adjustColorContrast: THREE.IUniform<number>;
  adjustColorBrightness: THREE.IUniform<number>;
  adjustColorFade: THREE.IUniform<number>;

  // Cutout Fade
  enableCutoutFade: THREE.IUniform<boolean>;
  cutoutFadeTexture: THREE.IUniform<THREE.Texture | null>;
  cutoutFadeFrom: THREE.IUniform<number>;
  cutoutFadeTo: THREE.IUniform<number>;

  [key: string]: THREE.IUniform;
}

export interface CartoonCoffee_Particle_BasicOptions {
  // 텍스처
  texture?: THREE.Texture;
  noiseTexture?: THREE.Texture;

  // 기본 색상
  tintColor?: THREE.Color | THREE.Vector4;
  opacity?: number;

  // UV Distort
  enableUVDistort?: boolean;
  uvDistortFrom?: THREE.Vector2;
  uvDistortTo?: THREE.Vector2;
  uvDistortSpeed?: THREE.Vector2;
  uvDistortNoiseScale?: THREE.Vector2;
  uvDistortFade?: number;

  // UV Scroll
  enableUVScroll?: boolean;
  uvScrollSpeed?: THREE.Vector2;

  // Custom Fade
  enableCustomFade?: boolean;
  customFadeMask?: THREE.Texture;
  customFadeNoiseScale?: THREE.Vector2;
  customFadeNoiseFactor?: number;
  customFadeSmoothness?: number;
  customFadeAlpha?: number;

  // Split Toning
  enableSplitToning?: boolean;
  splitToningHighlightsColor?: THREE.Vector4;
  splitToningShadowsColor?: THREE.Vector4;
  splitToningShift?: number;
  splitToningBalance?: number;
  splitToningContrast?: number;
  splitToningFade?: number;

  // Black Tint
  enableBlackTint?: boolean;
  blackTintColor?: THREE.Vector4;
  blackTintPower?: number;
  blackTintFade?: number;

  // Alpha Tint
  enableAlphaTint?: boolean;
  alphaTintColor?: THREE.Vector4;
  alphaTintPower?: number;
  alphaTintFade?: number;
  alphaTintMinAlpha?: number;

  // Adjust Color
  enableAdjustColor?: boolean;
  adjustColorHueShift?: number;
  adjustColorSaturation?: number;
  adjustColorContrast?: number;
  adjustColorBrightness?: number;
  adjustColorFade?: number;

  // Cutout Fade
  enableCutoutFade?: boolean;
  cutoutFadeTexture?: THREE.Texture;
  cutoutFadeFrom?: number;
  cutoutFadeTo?: number;
}

const vertexShader = /* glsl */`
  attribute vec4 color;

  varying vec2 vUv;
  varying vec4 vColor;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  void main() {
    vUv = uv;
    vColor = color;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vLocalPosition = position;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  uniform sampler2D map;
  uniform sampler2D noiseTexture;
  uniform float time;
  uniform vec4 tintColor;

  // UV Distort
  uniform bool enableUVDistort;
  uniform vec2 uvDistortFrom;
  uniform vec2 uvDistortTo;
  uniform vec2 uvDistortSpeed;
  uniform vec2 uvDistortNoiseScale;
  uniform float uvDistortFade;

  // UV Scroll
  uniform bool enableUVScroll;
  uniform vec2 uvScrollSpeed;

  // Custom Fade
  uniform bool enableCustomFade;
  uniform sampler2D customFadeMask;
  uniform vec2 customFadeNoiseScale;
  uniform float customFadeNoiseFactor;
  uniform float customFadeSmoothness;
  uniform float customFadeAlpha;

  // Split Toning
  uniform bool enableSplitToning;
  uniform vec4 splitToningHighlightsColor;
  uniform vec4 splitToningShadowsColor;
  uniform float splitToningShift;
  uniform float splitToningBalance;
  uniform float splitToningContrast;
  uniform float splitToningFade;

  // Black Tint
  uniform bool enableBlackTint;
  uniform vec4 blackTintColor;
  uniform float blackTintPower;
  uniform float blackTintFade;

  // Alpha Tint
  uniform bool enableAlphaTint;
  uniform vec4 alphaTintColor;
  uniform float alphaTintPower;
  uniform float alphaTintFade;
  uniform float alphaTintMinAlpha;

  // Adjust Color
  uniform bool enableAdjustColor;
  uniform float adjustColorHueShift;
  uniform float adjustColorSaturation;
  uniform float adjustColorContrast;
  uniform float adjustColorBrightness;
  uniform float adjustColorFade;

  // Cutout Fade
  uniform bool enableCutoutFade;
  uniform sampler2D cutoutFadeTexture;
  uniform float cutoutFadeFrom;
  uniform float cutoutFadeTo;

  varying vec2 vUv;
  varying vec4 vColor;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  // HSV <-> RGB 변환 함수
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // 안전한 pow 함수
  float safePow(float base, float exp) {
    return pow(max(abs(base), 0.0001), exp);
  }

  void main() {
    vec2 uv = vUv;

    // ============ UV Distort ============
    if (enableUVDistort) {
      vec2 noiseUV = (uv + uvDistortSpeed * time) * uvDistortNoiseScale;
      float noiseValue = texture2D(noiseTexture, noiseUV).r;
      vec2 distortion = mix(uvDistortFrom, uvDistortTo, noiseValue);
      uv += distortion * uvDistortFade;
    }

    // ============ UV Scroll ============
    if (enableUVScroll) {
      uv = mod(uv + uvScrollSpeed * time, 1.0);
    }

    // ============ 기본 텍스처 샘플링 ============
    vec4 texColor = texture2D(map, uv);
    vec4 color = texColor * vColor;

    // ============ Cutout Fade ============
    if (enableCutoutFade) {
      float fadeScale = mix(cutoutFadeFrom, cutoutFadeTo, vColor.a);
      fadeScale = max(fadeScale, 0.0001);
      vec2 cutoutUV = ((vUv - 0.5) / fadeScale) + 0.5;
      vec4 cutoutTex = texture2D(cutoutFadeTexture, cutoutUV);
      color.a = texColor.a * (1.0 - cutoutTex.r * cutoutTex.a);
      color.rgb = texColor.rgb * vColor.rgb;
    }

    // ============ Custom Fade ============
    if (enableCustomFade) {
      vec4 fadeMask = texture2D(customFadeMask, uv);
      float noiseVal = texture2D(noiseTexture, uv * customFadeNoiseScale).r * customFadeNoiseFactor;
      float fadeValue = (vColor.a * 2.0 - 1.0) + fadeMask.r + noiseVal;
      fadeValue = clamp(fadeValue, 0.0, 1.0);
      float smoothVal = customFadeSmoothness / max(fadeMask.r, 0.05);
      float fadePow = pow(fadeValue, smoothVal);
      color = vec4(vColor.rgb * texColor.rgb, texColor.a * fadePow * customFadeAlpha);
    }

    // ============ Split Toning ============
    if (enableSplitToning) {
      float luminance = (color.r + color.g + color.b) / 3.0;
      float tonePosition = clamp(((luminance + splitToningShift - 0.5) * splitToningBalance) + 0.5, 0.0, 1.0);
      vec3 toneColor = mix(splitToningShadowsColor.rgb, splitToningHighlightsColor.rgb, tonePosition);

      float contrast = max(splitToningContrast, 0.0);
      float contrastOffset = 0.1 * max(1.0 - contrast, 0.0);
      float contrastValue = safePow(luminance + contrastOffset, contrast);

      vec3 tonedColor = toneColor * contrastValue;
      color.rgb = mix(color.rgb, tonedColor, splitToningFade);
    }

    // ============ Black Tint ============
    if (enableBlackTint) {
      float maxChannel = max(max(color.r, color.g), color.b);
      maxChannel = min(maxChannel, 1.0);
      float darkness = safePow(1.0 - maxChannel, max(blackTintPower, 0.001));
      vec3 tinted = color.rgb + blackTintColor.rgb * darkness;
      color.rgb = mix(color.rgb, tinted, blackTintFade);
    }

    // ============ Alpha Tint ============
    if (enableAlphaTint) {
      float invAlpha = safePow(1.0 - color.a, alphaTintPower);
      float applyTint = step(alphaTintMinAlpha, color.a);
      vec3 tinted = mix(color.rgb, alphaTintColor.rgb, invAlpha * alphaTintFade * applyTint);
      color.rgb = tinted;
    }

    // ============ Adjust Color (HSV) ============
    if (enableAdjustColor) {
      vec3 hsv = rgb2hsv(color.rgb);

      // Hue shift
      hsv.x = fract(hsv.x + adjustColorHueShift);

      // Saturation
      hsv.y = clamp(hsv.y * adjustColorSaturation, 0.0, 1.0);

      // Contrast & Brightness
      float contrast = max(adjustColorContrast, 0.0);
      float contrastOffset = 0.1 * max(1.0 - contrast, 0.0);
      hsv.z = safePow(hsv.z + contrastOffset, contrast) * adjustColorBrightness;

      vec3 adjusted = hsv2rgb(hsv);
      color.rgb = mix(color.rgb, adjusted, adjustColorFade);
    }

    // 최종 tintColor 적용
    color *= tintColor * 2.0; // Unity의 TintColor는 0.5가 기본값이므로 2배

    gl_FragColor = color;
  }
`;

/**
 * CartoonCoffee/Particle Basic Material 생성 함수
 */
export function createCartoonCoffee_Particle_BasicMaterial(
  options: CartoonCoffee_Particle_BasicOptions = {}
): THREE.ShaderMaterial {

  const uniforms: CartoonCoffee_Particle_BasicUniforms = {
    // 기본 텍스처
    map: { value: options.texture || null },
    noiseTexture: { value: options.noiseTexture || null },
    time: { value: 0 },

    // Tint Color
    tintColor: {
      value: options.tintColor instanceof THREE.Vector4
        ? options.tintColor
        : new THREE.Vector4(0.5, 0.5, 0.5, options.opacity ?? 0.5)
    },

    // UV Distort
    enableUVDistort: { value: options.enableUVDistort ?? false },
    uvDistortFrom: { value: options.uvDistortFrom ?? new THREE.Vector2(-0.02, -0.02) },
    uvDistortTo: { value: options.uvDistortTo ?? new THREE.Vector2(0.02, 0.02) },
    uvDistortSpeed: { value: options.uvDistortSpeed ?? new THREE.Vector2(2, 2) },
    uvDistortNoiseScale: { value: options.uvDistortNoiseScale ?? new THREE.Vector2(0.1, 0.1) },
    uvDistortFade: { value: options.uvDistortFade ?? 1 },

    // UV Scroll
    enableUVScroll: { value: options.enableUVScroll ?? false },
    uvScrollSpeed: { value: options.uvScrollSpeed ?? new THREE.Vector2(0.2, 0) },

    // Custom Fade
    enableCustomFade: { value: options.enableCustomFade ?? false },
    customFadeMask: { value: options.customFadeMask || null },
    customFadeNoiseScale: { value: options.customFadeNoiseScale ?? new THREE.Vector2(1, 1) },
    customFadeNoiseFactor: { value: options.customFadeNoiseFactor ?? 0 },
    customFadeSmoothness: { value: options.customFadeSmoothness ?? 2 },
    customFadeAlpha: { value: options.customFadeAlpha ?? 1 },

    // Split Toning
    enableSplitToning: { value: options.enableSplitToning ?? false },
    splitToningHighlightsColor: { value: options.splitToningHighlightsColor ?? new THREE.Vector4(1, 0.1, 0.1, 0) },
    splitToningShadowsColor: { value: options.splitToningShadowsColor ?? new THREE.Vector4(0.1, 0.4, 1, 0) },
    splitToningShift: { value: options.splitToningShift ?? 0 },
    splitToningBalance: { value: options.splitToningBalance ?? 1 },
    splitToningContrast: { value: options.splitToningContrast ?? 1 },
    splitToningFade: { value: options.splitToningFade ?? 1 },

    // Black Tint
    enableBlackTint: { value: options.enableBlackTint ?? false },
    blackTintColor: { value: options.blackTintColor ?? new THREE.Vector4(1, 0, 0, 0) },
    blackTintPower: { value: options.blackTintPower ?? 2 },
    blackTintFade: { value: options.blackTintFade ?? 1 },

    // Alpha Tint
    enableAlphaTint: { value: options.enableAlphaTint ?? false },
    alphaTintColor: { value: options.alphaTintColor ?? new THREE.Vector4(23.96863, 1.254902, 23.96863, 0) },
    alphaTintPower: { value: options.alphaTintPower ?? 1 },
    alphaTintFade: { value: options.alphaTintFade ?? 1 },
    alphaTintMinAlpha: { value: options.alphaTintMinAlpha ?? 0.05 },

    // Adjust Color
    enableAdjustColor: { value: options.enableAdjustColor ?? false },
    adjustColorHueShift: { value: options.adjustColorHueShift ?? 0 },
    adjustColorSaturation: { value: options.adjustColorSaturation ?? 1 },
    adjustColorContrast: { value: options.adjustColorContrast ?? 1 },
    adjustColorBrightness: { value: options.adjustColorBrightness ?? 1 },
    adjustColorFade: { value: options.adjustColorFade ?? 1 },

    // Cutout Fade
    enableCutoutFade: { value: options.enableCutoutFade ?? false },
    cutoutFadeTexture: { value: options.cutoutFadeTexture || null },
    cutoutFadeFrom: { value: options.cutoutFadeFrom ?? 0 },
    cutoutFadeTo: { value: options.cutoutFadeTo ?? 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending, // SrcAlpha OneMinusSrcAlpha
  });

  return material;
}

/**
 * Material의 time uniform을 업데이트하는 헬퍼 함수
 */
export function updateCartoonCoffee_Particle_BasicTime(
  material: THREE.ShaderMaterial,
  time: number
): void {
  if (material.uniforms.time) {
    material.uniforms.time.value = time;
  }
}

/**
 * Material 속성을 JSON에서 적용하는 헬퍼 함수
 */
export function applyCartoonCoffee_Particle_BasicProperties(
  material: THREE.ShaderMaterial,
  properties: {
    floats?: Array<{ name: string; value: number }>;
    colors?: Array<{ name: string; value: { r: number; g: number; b: number; a: number } }>;
  }
): void {
  const uniformMap: Record<string, string> = {
    // UV Distort
    '_EnableUVDistort': 'enableUVDistort',
    '_UVDistortFade': 'uvDistortFade',

    // UV Scroll
    '_EnableUVScroll': 'enableUVScroll',

    // Custom Fade
    '_EnableCustomFade': 'enableCustomFade',
    '_CustomFadeNoiseFactor': 'customFadeNoiseFactor',
    '_CustomFadeSmoothness': 'customFadeSmoothness',
    '_CustomFadeAlpha': 'customFadeAlpha',

    // Split Toning
    '_EnableSplitToning': 'enableSplitToning',
    '_SplitToningShift': 'splitToningShift',
    '_SplitToningBalance': 'splitToningBalance',
    '_SplitToningContrast': 'splitToningContrast',
    '_SplitToningFade': 'splitToningFade',

    // Black Tint
    '_EnableBlackTint': 'enableBlackTint',
    '_BlackTintPower': 'blackTintPower',
    '_BlackTintFade': 'blackTintFade',

    // Alpha Tint
    '_EnableAlphaTint': 'enableAlphaTint',
    '_AlphaTintPower': 'alphaTintPower',
    '_AlphaTintFade': 'alphaTintFade',
    '_AlphaTintMinAlpha': 'alphaTintMinAlpha',

    // Adjust Color
    '_EnableAdjustColor': 'enableAdjustColor',
    '_AdjustColorHueShift': 'adjustColorHueShift',
    '_AdjustColorSaturation': 'adjustColorSaturation',
    '_AdjustColorContrast': 'adjustColorContrast',
    '_AdjustColorBrightness': 'adjustColorBrightness',
    '_AdjustColorFade': 'adjustColorFade',

    // Cutout Fade
    '_EnableCutoutSprite': 'enableCutoutFade',
    '_CutoutFadeFrom': 'cutoutFadeFrom',
    '_CutoutFadeTo': 'cutoutFadeTo',
  };

  const colorMap: Record<string, string> = {
    '_TintColor': 'tintColor',
    '_SplitToningHighlightsColor': 'splitToningHighlightsColor',
    '_SplitToningShadowsColor': 'splitToningShadowsColor',
    '_BlackTintColor': 'blackTintColor',
    '_AlphaTintColor': 'alphaTintColor',
    '_UVDistortFrom': 'uvDistortFrom',
    '_UVDistortTo': 'uvDistortTo',
    '_UVDistortSpeed': 'uvDistortSpeed',
    '_UVDistortNoiseScale': 'uvDistortNoiseScale',
    '_UVScrollSpeed': 'uvScrollSpeed',
    '_CustomFadeNoiseScale': 'customFadeNoiseScale',
  };

  // Float 속성 적용
  if (properties.floats) {
    for (const prop of properties.floats) {
      const uniformName = uniformMap[prop.name];
      if (uniformName && material.uniforms[uniformName]) {
        // Enable 플래그는 boolean으로 변환
        if (uniformName.startsWith('enable')) {
          material.uniforms[uniformName].value = prop.value !== 0;
        } else {
          material.uniforms[uniformName].value = prop.value;
        }
      }
    }
  }

  // Color 속성 적용
  if (properties.colors) {
    for (const prop of properties.colors) {
      const uniformName = colorMap[prop.name];
      if (uniformName && material.uniforms[uniformName]) {
        const value = prop.value;
        // Vector2인 경우 (UV 관련)
        if (uniformName.includes('Scroll') || uniformName.includes('Distort') || uniformName.includes('Scale')) {
          material.uniforms[uniformName].value = new THREE.Vector2(value.r, value.g);
        } else {
          // Vector4인 경우 (색상)
          material.uniforms[uniformName].value = new THREE.Vector4(value.r, value.g, value.b, value.a);
        }
      }
    }
  }
}

// 기본 export
export default createCartoonCoffee_Particle_BasicMaterial;
