import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CelestialBody, SimulationConfig, PhysicalMetrics } from '../types';
import {
  stepSymplecticVerlet,
  stepRK4,
  stepPINNSurrogate,
  computeMetrics,
  computeAdaptiveTimeStep,
  resetBarycentricDrift,
} from '../physics';
import { createSunPlasmaMaterial, createSunCoronaMesh } from '../visuals/SunShader';
import { createAtmosphereMesh } from '../visuals/AtmosphereShader';
import { createCosmicStarfield } from '../visuals/CosmicStarfield';
import { GlowingTrail } from '../visuals/GlowingTrail';

interface OrbitCanvas3DProps {
  bodies: CelestialBody[];
  setBodies: React.Dispatch<React.SetStateAction<CelestialBody[]>>;
  config: SimulationConfig;
  setMetrics: React.Dispatch<React.SetStateAction<PhysicalMetrics>>;
  initialEnergyRef: React.MutableRefObject<number>;
}

/**
 * Recursively disposes geometries and materials from Three.js scene hierarchy
 * preventing GPU WebGL context leaks when mounting/unmounting components.
 */
function disposeHierarchy(node: THREE.Object3D) {
  for (let i = node.children.length - 1; i >= 0; i--) {
    disposeHierarchy(node.children[i]);
  }
  if ('geometry' in node && (node as THREE.Mesh).geometry) {
    ((node as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
  }
  if ('material' in node && (node as THREE.Mesh).material) {
    const mat = (node as THREE.Mesh).material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else {
      mat.dispose();
    }
  }
}

export const OrbitCanvas3D: React.FC<OrbitCanvas3DProps> = ({
  bodies,
  setBodies,
  config,
  setMetrics,
  initialEnergyRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<CelestialBody[]>(bodies);
  bodiesRef.current = bodies;

  const configRef = useRef<SimulationConfig>(config);
  configRef.current = config;

  const stepCountRef = useRef<number>(0);
  const simTimeRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // slate-950 deep space

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1500
    );
    camera.position.set(0, -22, 14);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Post-Processing: EffectComposer + UnrealBloomPass
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      configRef.current.bloomIntensity || 1.2,
      0.45,
      0.82
    );
    bloomPass.threshold = 0.18;
    bloomPass.strength = configRef.current.bloomIntensity || 1.2;
    bloomPass.radius = 0.55;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 3. Space Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffedd5, 3.0, 500, 0.08);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // 4. Cosmic Starfield (5,500+ multi-spectral stars + nebulae dust clouds)
    const starfield = createCosmicStarfield(5500);
    scene.add(starfield.starsGroup);

    // 5. Grid helper on ecliptic plane
    const gridHelper = new THREE.GridHelper(50, 50, 0x1e293b, 0x090d16);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // 6. Body Meshes, Aux Glow Meshes & Glowing Trails Maps
    const bodyMeshes = new Map<string, THREE.Mesh>();
    const bodyAuxMeshes = new Map<string, THREE.Mesh>();
    const glowingTrails = new Map<string, GlowingTrail>();

    const clock = new THREE.Clock();

    // 7. Camera Orbit Interaction (Mouse drag / scroll)
    let isDragging = false;
    let isPanning = false;
    let prevMouse = { x: 0, y: 0 };
    let theta = -Math.PI / 2;
    let phi = Math.PI / 3.5;
    let radius = 28;
    const target = new THREE.Vector3(0, 0, 0);

    const updateCameraPos = () => {
      camera.position.x = target.x + radius * Math.sin(phi) * Math.cos(theta);
      camera.position.y = target.y + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.z = target.z + radius * Math.cos(phi);
      camera.lookAt(target);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isDragging = true;
      if (e.button === 2) isPanning = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      if (isDragging) {
        theta -= dx * 0.008;
        phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - dy * 0.008));
        updateCameraPos();
      } else if (isPanning) {
        const factor = radius * 0.0015;
        target.x -= dx * factor * Math.sin(theta);
        target.y += dx * factor * Math.cos(theta);
        target.z += dy * factor;
        updateCameraPos();
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      isPanning = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(3, Math.min(220, radius + e.deltaY * 0.03));
      updateCameraPos();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    // 8. Animation / Simulation Loop
    let animationFrameId: number;
    let lastUiUpdateTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const cfg = configRef.current;
      let currentBodies = bodiesRef.current;
      const elapsedTime = clock.getElapsedTime();

      // Dynamic starfield twinkling update
      starfield.update(elapsedTime);

      // Dynamically update bloom intensity
      bloomPass.strength = cfg.bloomIntensity;

      // Physics Integration Loop with Adaptive Sub-Stepping
      if (!cfg.paused && currentBodies.length > 0) {
        let dtSub = cfg.timeStep;
        let subSteps = 1;

        if (cfg.adaptiveTimeStep) {
          const adaptiveDt = computeAdaptiveTimeStep(
            currentBodies,
            cfg.G,
            0.05,
            0.0001,
            cfg.timeStep
          );
          // Calculate dynamically bounded sub-steps (1 to 16)
          subSteps = Math.max(1, Math.min(16, Math.round(cfg.timeStep / adaptiveDt)));
          dtSub = cfg.timeStep / subSteps;
        } else {
          subSteps = Math.max(1, Math.round(cfg.speedMultiplier * 4));
          dtSub = cfg.timeStep / 4;
        }

        for (let s = 0; s < subSteps; s++) {
          if (cfg.integrator === 'symplectic_verlet') {
            currentBodies = stepSymplecticVerlet(currentBodies, dtSub, cfg.G, cfg.softening);
          } else if (cfg.integrator === 'rk4') {
            currentBodies = stepRK4(currentBodies, dtSub, cfg.G, cfg.softening);
          } else {
            currentBodies = stepPINNSurrogate(currentBodies, dtSub, cfg.G, cfg.softening);
          }
          stepCountRef.current += 1;
          simTimeRef.current += dtSub;
        }

        // Center-of-mass barycentric drift stabilization
        if (cfg.barycenterReset && stepCountRef.current % 12 === 0) {
          currentBodies = resetBarycentricDrift(currentBodies, false);
        }

        // Update body trails
        currentBodies = currentBodies.map((b) => {
          const newTrail = [...b.trail, { ...b.position }];
          if (newTrail.length > cfg.trailLength) {
            newTrail.splice(0, newTrail.length - cfg.trailLength);
          }
          return { ...b, trail: newTrail };
        });

        bodiesRef.current = currentBodies;

        // Throttled UI state synchronization (~15 FPS) to eliminate React re-render thrashing at 60 FPS
        const now = performance.now();
        if (now - lastUiUpdateTime >= 66) {
          lastUiUpdateTime = now;
          setBodies(currentBodies);
          const metrics = computeMetrics(
            currentBodies,
            cfg.G,
            cfg.softening,
            initialEnergyRef.current,
            stepCountRef.current,
            simTimeRef.current
          );
          setMetrics(metrics);
        }
      }

      // Synchronize Three.js 3D Celestial Objects & Shaders
      currentBodies.forEach((b) => {
        let mesh = bodyMeshes.get(b.id);
        let auxMesh = bodyAuxMeshes.get(b.id);

        if (!mesh) {
          const geo = new THREE.SphereGeometry(b.radius, 32, 32);
          if (b.emissive) {
            // Emissive Solar Star: Custom Simplex Noise Plasma Material
            const plasmaMat = createSunPlasmaMaterial(b.color);
            mesh = new THREE.Mesh(geo, plasmaMat);
            auxMesh = createSunCoronaMesh(b.radius, b.color);
          } else {
            // Planet / Satellite: High-fidelity standard material + Rayleigh atmospheric halo
            const standardMat = new THREE.MeshStandardMaterial({
              color: b.color,
              roughness: 0.35,
              metalness: 0.15,
            });
            mesh = new THREE.Mesh(geo, standardMat);
            auxMesh = createAtmosphereMesh(b.radius, b.color);
          }

          scene.add(mesh);
          bodyMeshes.set(b.id, mesh);

          if (auxMesh) {
            scene.add(auxMesh);
            bodyAuxMeshes.set(b.id, auxMesh);
          }
        }

        mesh.position.set(b.position.x, b.position.y, b.position.z);

        if (auxMesh) {
          auxMesh.position.set(b.position.x, b.position.y, b.position.z);
          if ('material' in auxMesh && (auxMesh.material as THREE.ShaderMaterial).uniforms?.uTime) {
            (auxMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedTime;
          }
        }

        // Update solar plasma time uniform
        if ('material' in mesh && (mesh.material as THREE.ShaderMaterial).uniforms?.uTime) {
          (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedTime;
        }

        // Glowing orbital trajectory trail with vertex-alpha gradient
        let trail = glowingTrails.get(b.id);
        if (!trail) {
          trail = new GlowingTrail(b.color);
          scene.add(trail.line);
          glowingTrails.set(b.id, trail);
        }
        trail.update(b.trail);
      });

      // Remove defunct bodies and auxiliary meshes
      for (const [id, mesh] of bodyMeshes.entries()) {
        if (!currentBodies.some((b) => b.id === id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
          bodyMeshes.delete(id);
        }
      }

      for (const [id, aux] of bodyAuxMeshes.entries()) {
        if (!currentBodies.some((b) => b.id === id)) {
          scene.remove(aux);
          aux.geometry.dispose();
          if (Array.isArray(aux.material)) {
            aux.material.forEach((m) => m.dispose());
          } else {
            aux.material.dispose();
          }
          bodyAuxMeshes.delete(id);
        }
      }

      for (const [id, trail] of glowingTrails.entries()) {
        if (!currentBodies.some((b) => b.id === id)) {
          scene.remove(trail.line);
          trail.dispose();
          glowingTrails.delete(id);
        }
      }

      // Render via Post-Processing UnrealBloomPass or standard renderer
      if (cfg.bloomEnabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    animate();

    // 9. Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);

      // Cleanly dispose all Three.js WebGL GPU resources and geometries
      starfield.dispose();
      composer.dispose();
      glowingTrails.forEach((t) => t.dispose());
      glowingTrails.clear();
      disposeHierarchy(scene);
      renderer.dispose();
      renderer.forceContextLoss();

      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* HUD Overlay Info - Bottom-left glassmorphism telemetry panel */}
      <div className="absolute bottom-6 left-6 pointer-events-none flex flex-col gap-1.5 bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-xl px-4 py-3 shadow-2xl text-xs font-mono">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 animate-pulse" />
            <span>AstroDynamics 3D Photoreal Engine</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-300 font-semibold border border-cyan-500/30">
            WebGL 3D
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-300 mt-1">
          <div>
            Integrator: <span className="text-cyan-400 font-medium">{config.integrator}</span>
          </div>
          <div>
            Bodies: <span className="text-white font-medium">{bodies.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
              config.adaptiveTimeStep
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Adaptive Δt: {config.adaptiveTimeStep ? 'ON' : 'OFF'}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
              config.barycenterReset
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Barycentric Lock: {config.barycenterReset ? 'LOCKED' : 'OFF'}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
              config.bloomEnabled
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            HDR Bloom: {config.bloomEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="text-slate-500 text-[10px] mt-0.5">
          Left-Click: Orbit | Right-Click: Pan | Scroll: Zoom
        </div>
      </div>
    </div>
  );
};
