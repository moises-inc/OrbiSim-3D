import * as THREE from 'three';

// Harvard Spectral Classification Color Temperatures
const SPECTRAL_COLORS: THREE.Color[] = [
  new THREE.Color('#9bb0ff'), // Class O (35,000 K - Deep Blue)
  new THREE.Color('#bbccff'), // Class B (20,000 K - Blue-White)
  new THREE.Color('#f8f9ff'), // Class A (9,000 K - Pure White)
  new THREE.Color('#fff4ea'), // Class F (7,000 K - Yellow-White)
  new THREE.Color('#fff2a3'), // Class G (5,500 K - Solar Yellow)
  new THREE.Color('#ffd2a1'), // Class K (4,000 K - Warm Orange)
  new THREE.Color('#ff8f70'), // Class M (3,000 K - Cool Red Giant)
];

export interface CosmicStarfieldObject {
  starsGroup: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

export function createCosmicStarfield(starCount = 5500): CosmicStarfieldObject {
  const starsGroup = new THREE.Group();

  // 1. Multi-Spectral Star Particles
  const starGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const phases = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    // Spherical shell distribution for natural deep space immersion
    const radius = 180 + Math.random() * 320;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Weighted spectral class selection (more G/K/M dwarfs than rare O/B giants)
    const rand = Math.random();
    let spectralIdx = 4; // default G
    if (rand < 0.05) spectralIdx = 0;      // O
    else if (rand < 0.15) spectralIdx = 1; // B
    else if (rand < 0.30) spectralIdx = 2; // A
    else if (rand < 0.50) spectralIdx = 3; // F
    else if (rand < 0.70) spectralIdx = 4; // G
    else if (rand < 0.88) spectralIdx = 5; // K
    else spectralIdx = 6;                  // M

    const col = SPECTRAL_COLORS[spectralIdx];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    // Star apparent magnitudes / sizes
    sizes[i] = (Math.random() < 0.04 ? 2.5 : 1.0 + Math.random() * 1.5) * window.devicePixelRatio;
    phases[i] = Math.random() * Math.PI * 2;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float size;
      attribute float phase;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        // Subtle twinkling animation based on time and individual star phase
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.8 + phase * 4.0);
        vAlpha = twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        // Gaussian smooth circular particle with anti-aliasing
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float intensity = exp(-dist * dist * 10.0);
        gl_FragColor = vec4(vColor * 1.3, intensity * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  starsGroup.add(starPoints);

  // 2. Cosmic Nebulae Clouds (Volumetric Dust)
  const nebulaCount = 6;
  const nebulaColors = [
    new THREE.Color('#3b0764'), // Deep violet
    new THREE.Color('#1e1b4b'), // Cosmic indigo
    new THREE.Color('#0f172a'), // Dark slate
    new THREE.Color('#0369a1'), // Celestial cyan
    new THREE.Color('#701a75'), // Deep magenta
    new THREE.Color('#1e3a8a'), // Royal cobalt
  ];

  const nebulaMeshes: THREE.Mesh[] = [];

  nebulaColors.forEach((nebColor, idx) => {
    const nebGeo = new THREE.PlaneGeometry(350, 350);
    const nebMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: nebColor },
        uSeed: { value: idx * 1.37 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uSeed;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - vec2(0.5);
          float d = length(center);
          // Soft radial falloff for nebula dust cloud
          float alpha = smoothstep(0.5, 0.0, d) * 0.12;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const nebMesh = new THREE.Mesh(nebGeo, nebMat);
    const angle = (idx / nebulaCount) * Math.PI * 2;
    nebMesh.position.set(
      Math.cos(angle) * 140,
      Math.sin(angle) * 140,
      (idx - nebulaCount / 2) * 45
    );
    nebMesh.rotation.z = Math.random() * Math.PI;
    starsGroup.add(nebMesh);
    nebulaMeshes.push(nebMesh);
  });

  return {
    starsGroup,
    update: (time: number) => {
      starMat.uniforms.uTime.value = time;
      // Gentle cosmic drift
      starsGroup.rotation.z = time * 0.003;
      nebulaMeshes.forEach((mesh, i) => {
        mesh.rotation.z += 0.0004 * (i % 2 === 0 ? 1 : -1);
      });
    },
    dispose: () => {
      starGeo.dispose();
      starMat.dispose();
      nebulaMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    },
  };
}
