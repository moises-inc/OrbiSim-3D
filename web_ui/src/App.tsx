import { useState, useRef } from 'react';
import { CelestialBody, SimulationConfig, PhysicalMetrics } from './types';
import { PRESETS, computeMetrics } from './physics';
import { OrbitCanvas3D } from './components/OrbitCanvas3D';
import { ControlsPanel } from './components/ControlsPanel';
import { Orbit, Compass } from 'lucide-react';

export function App() {
  const initialPreset = PRESETS.kepler;
  const [bodies, setBodies] = useState<CelestialBody[]>(() =>
    JSON.parse(JSON.stringify(initialPreset.bodies))
  );

  const [config, setConfig] = useState<SimulationConfig>({
    G: initialPreset.G,
    timeStep: initialPreset.dt,
    softening: 1e-4,
    integrator: 'symplectic_verlet',
    trailLength: 400,
    paused: false,
    speedMultiplier: 1.0,
    adaptiveTimeStep: true,
    barycenterReset: true,
    bloomEnabled: true,
    bloomIntensity: 1.2,
  });

  const initialMetrics = computeMetrics(
    initialPreset.bodies,
    initialPreset.G,
    1e-4,
    0,
    0,
    0
  );
  initialMetrics.initialEnergy = initialMetrics.totalEnergy;

  const [metrics, setMetrics] = useState<PhysicalMetrics>(initialMetrics);
  const initialEnergyRef = useRef<number>(initialMetrics.totalEnergy);

  const handleResetPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey] || PRESETS.kepler;
    const clonedBodies: CelestialBody[] = JSON.parse(JSON.stringify(preset.bodies));
    setBodies(clonedBodies);
    setConfig((prev) => ({
      ...prev,
      G: preset.G,
      timeStep: preset.dt,
      paused: false,
    }));

    const freshMetrics = computeMetrics(clonedBodies, preset.G, 1e-4, 0, 0, 0);
    freshMetrics.initialEnergy = freshMetrics.totalEnergy;
    initialEnergyRef.current = freshMetrics.totalEnergy;
    setMetrics(freshMetrics);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-900/60 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Orbit className="w-4 h-4 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">OrbiSim-3D</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Proyecto Tennessee
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              High-Performance N-Body Engine & Symplectic PINNs Surrogate
            </p>
          </div>
        </div>

        {/* System Badges */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs font-mono pr-72">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Compass className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px]">C++20 SIMD Core</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[11px]">PyTorch HNN</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px]">Three.js WebGL</span>
          </div>
        </div>
      </header>

      {/* 3D WebGL Canvas Layer */}
      <section className="flex-1 w-full h-full relative" aria-label="3D Orbital Simulation Canvas">
        <OrbitCanvas3D
          bodies={bodies}
          setBodies={setBodies}
          config={config}
          setMetrics={setMetrics}
          initialEnergyRef={initialEnergyRef}
        />
        {/* Interactive Controls Overlay */}
        <ControlsPanel
          bodies={bodies}
          setBodies={setBodies}
          config={config}
          setConfig={setConfig}
          metrics={metrics}
          onResetPreset={handleResetPreset}
        />
      </section>
    </main>
  );
}

export default App;
