import * as THREE from 'three';

// 3D Simplex noise GLSL implementation for dynamic solar granulation & plasma
const noiseGLSL = `
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export function createSunPlasmaMaterial(baseColorHex = '#fbbf24'): THREE.ShaderMaterial {
  const baseColor = new THREE.Color(baseColorHex);
  const coreColor = new THREE.Color('#ffffff');
  const flareColor = new THREE.Color('#ef4444');

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorCore: { value: coreColor },
      uColorBase: { value: baseColor },
      uColorFlare: { value: flareColor },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorCore;
      uniform vec3 uColorBase;
      uniform vec3 uColorFlare;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;

      ${noiseGLSL}

      void main() {
        vec3 norm = normalize(vNormal);
        vec3 viewDir = normalize(-vWorldPosition);

        // Multi-frequency solar granulation
        float t = uTime * 0.45;
        float n1 = snoise(vPosition * 3.5 + vec3(0.0, t * 0.8, t * 0.4));
        float n2 = snoise(vPosition * 8.0 - vec3(t * 0.5, 0.0, t * 0.7)) * 0.5;
        float noiseVal = (n1 + n2) * 0.5 + 0.5; // [0, 1]

        // Dynamic plasma palette interpolation
        vec3 color = mix(uColorBase, uColorCore, pow(noiseVal, 1.8));
        color = mix(color, uColorFlare, (1.0 - noiseVal) * 0.65);

        // Intense Fresnel solar rim limb brightening
        float fresnel = 1.0 - max(dot(norm, viewDir), 0.0);
        float rimGlow = pow(fresnel, 2.2) * 1.8;
        color += uColorBase * rimGlow + uColorCore * pow(fresnel, 4.0);

        gl_FragColor = vec4(color * 1.4, 1.0);
      }
    `,
  });
}

export function createSunCoronaMesh(radius: number, colorHex = '#f59e0b'): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius * 1.45, 32, 32);
  const color = new THREE.Color(colorHex);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 viewDir = normalize(-vWorldPosition);
        float vDotN = dot(vNormal, viewDir);
        float fresnel = 1.0 - abs(vDotN);

        // Corona breathing pulsation
        float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
        float alpha = pow(fresnel, 3.2) * 0.85 * pulse;

        gl_FragColor = vec4(uColor * 2.2, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });

  return new THREE.Mesh(geo, mat);
}
