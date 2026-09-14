import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CelestialBody, SimulationConfig, PhysicalMetrics } from '../types';
import {
  stepSymplecticVerlet,
  stepRK4,
  stepPINNSurrogate,
  computeMetrics,
} from '../physics';

interface OrbitCanvas3DProps {
  bodies: CelestialBody[];
  setBodies: React.Dispatch<React.SetStateAction<CelestialBody[]>>;
  config: SimulationConfig;
  setMetrics: React.Dispatch<React.SetStateAction<PhysicalMetrics>>;
  initialEnergyRef: React.MutableRefObject<number>;
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
    scene.background = new THREE.Color(0x030712); // slate-950

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, -22, 14);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // 2. Space Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffedd5, 2.5, 300, 0.1);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // 3. Starfield particles
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starCoords[i] = (Math.random() - 0.5) * 350;
      starCoords[i + 1] = (Math.random() - 0.5) * 350;
      starCoords[i + 2] = (Math.random() - 0.5) * 350;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 4. Grid helper on ecliptic plane
    const gridHelper = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // 5. Body Meshes & Trail Lines Map
    const bodyMeshes = new Map<string, THREE.Mesh>();
    const trailLines = new Map<string, THREE.Line>();

    // 6. Camera Orbit Interaction (Mouse drag / scroll)
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
      radius = Math.max(3, Math.min(180, radius + e.deltaY * 0.03));
      updateCameraPos();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    // 7. Animation / Simulation Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const cfg = configRef.current;
      let currentBodies = bodiesRef.current;

      // Sub-stepping for physics stability
      if (!cfg.paused && currentBodies.length > 0) {
        const subSteps = Math.max(1, Math.round(cfg.speedMultiplier * 4));
        const dtSub = cfg.timeStep / 4;

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

        // Update trails
        currentBodies = currentBodies.map((b) => {
          const newTrail = [...b.trail, { ...b.position }];
          if (newTrail.length > cfg.trailLength) {
            newTrail.splice(0, newTrail.length - cfg.trailLength);
          }
          return { ...b, trail: newTrail };
        });

        bodiesRef.current = currentBodies;
        setBodies(currentBodies);

        // Update metrics
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

      // Synchronize Three.js objects
      currentBodies.forEach((b) => {
        let mesh = bodyMeshes.get(b.id);
        if (!mesh) {
          const geo = new THREE.SphereGeometry(b.radius, 32, 32);
          const mat = new THREE.MeshStandardMaterial({
            color: b.color,
            emissive: b.emissive ? b.color : 0x000000,
            emissiveIntensity: b.emissive ? 0.8 : 0.0,
            roughness: 0.3,
            metalness: 0.2,
          });
          mesh = new THREE.Mesh(geo, mat);
          scene.add(mesh);
          bodyMeshes.set(b.id, mesh);
        }
        mesh.position.set(b.position.x, b.position.y, b.position.z);

        // Trail line
        let line = trailLines.get(b.id);
        if (!line) {
          const lineGeo = new THREE.BufferGeometry();
          const lineMat = new THREE.LineBasicMaterial({
            color: b.color,
            transparent: true,
            opacity: 0.65,
          });
          line = new THREE.Line(lineGeo, lineMat);
          scene.add(line);
          trailLines.set(b.id, line);
        }

        if (b.trail.length > 1) {
          const pts = new Float32Array(b.trail.length * 3);
          b.trail.forEach((pt, idx) => {
            pts[idx * 3] = pt.x;
            pts[idx * 3 + 1] = pt.y;
            pts[idx * 3 + 2] = pt.z;
          });
          line.geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3));
          line.geometry.attributes.position.needsUpdate = true;
          line.visible = true;
        } else {
          line.visible = false;
        }
      });

      // Remove defunct bodies
      for (const [id, mesh] of bodyMeshes.entries()) {
        if (!currentBodies.some((b) => b.id === id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          bodyMeshes.delete(id);
        }
      }
      for (const [id, line] of trailLines.entries()) {
        if (!currentBodies.some((b) => b.id === id)) {
          scene.remove(line);
          line.geometry.dispose();
          trailLines.delete(id);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
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
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* HUD Overlay Info */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg px-3.5 py-2.5 shadow-xl text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>OrbiSim-3D Engine</span>
        </div>
        <div className="text-slate-400 mt-1">
          Active Integrator: <span className="text-cyan-400 font-medium">{config.integrator}</span>
        </div>
        <div className="text-slate-400">
          Bodies Count: <span className="text-white font-medium">{bodies.length}</span>
        </div>
        <div className="text-slate-500 text-[10px] mt-0.5">
          Rotate: Left-Click + Drag | Pan: Right-Click | Zoom: Scroll
        </div>
      </div>
    </div>
  );
};
