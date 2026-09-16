import * as THREE from 'three';

/**
 * Creates an ethereal Rayleigh scattering atmospheric glow around planetary bodies.
 */
export function createAtmosphereMesh(radius: number, colorHex = '#38bdf8'): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius * 1.18, 32, 32);
  const color = new THREE.Color(colorHex);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uPower: { value: 3.5 },
      uIntensity: { value: 1.25 },
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
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 viewDir = normalize(-vWorldPosition);
        // Inverted Fresnel gives radiant glowing atmospheric rim
        float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
        float alpha = pow(fresnel, uPower) * uIntensity;

        gl_FragColor = vec4(uColor * 1.5, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });

  return new THREE.Mesh(geo, mat);
}
