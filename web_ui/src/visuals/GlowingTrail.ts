import * as THREE from 'three';
import { Vector3D } from '../types';

/**
 * Manages an individual celestial body's glowing orbital trajectory trail.
 * Uses a vertex-colored Line with gradient luminosity and alpha falloff from head to tail.
 */
export class GlowingTrail {
  public line: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private baseColor: THREE.Color;

  constructor(baseColorHex: string) {
    this.baseColor = new THREE.Color(baseColorHex);
    this.geometry = new THREE.BufferGeometry();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.baseColor },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;

        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          // Intense glowing trajectory with exponential fade towards the tail
          vec3 glowColor = uColor * (1.2 + 0.8 * vAlpha);
          gl_FragColor = vec4(glowColor, vAlpha * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.line = new THREE.Line(this.geometry, this.material);
  }

  public update(trail: Vector3D[]) {
    const len = trail.length;
    if (len < 2) {
      this.line.visible = false;
      return;
    }

    this.line.visible = true;
    const positions = new Float32Array(len * 3);
    const alphas = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      positions[i * 3] = trail[i].x;
      positions[i * 3 + 1] = trail[i].y;
      positions[i * 3 + 2] = trail[i].z;

      // Alpha gradient: 0.0 at oldest point (tail), 1.0 at newest point (head)
      const progress = i / (len - 1);
      alphas[i] = Math.pow(progress, 1.6); // smooth cubic ease-in
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.geometry.attributes.position.needsUpdate = true;
    if (this.geometry.attributes.aAlpha) {
      this.geometry.attributes.aAlpha.needsUpdate = true;
    }
  }

  public setColor(hex: string) {
    this.baseColor.set(hex);
    this.material.uniforms.uColor.value.set(hex);
  }

  public dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
