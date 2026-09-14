import React, { useState } from 'react';
import { CelestialBody, SimulationConfig, PhysicalMetrics, IntegratorType } from '../types';
import { PRESETS } from '../physics';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Activity,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ControlsPanelProps {
  bodies: CelestialBody[];
  setBodies: React.Dispatch<React.SetStateAction<CelestialBody[]>>;
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  metrics: PhysicalMetrics;
  onResetPreset: (presetKey: string) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  bodies,
  setBodies,
  config,
  setConfig,
  metrics,
  onResetPreset,
}) => {
  const [selectedBodyId, setSelectedBodyId] = useState<string>(bodies[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'physics' | 'body' | 'metrics'>('physics');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('kepler');

  const handleSelectPreset = (key: string) => {
    setActivePreset(key);
    onResetPreset(key);
  };

  const selectedBody = bodies.find((b) => b.id === selectedBodyId) || bodies[0];

  const handleBodyParamChange = (field: 'mass' | 'vx' | 'vy' | 'vz', value: number) => {
    if (!selectedBody) return;
    setBodies((prev) =>
      prev.map((b) => {
        if (b.id !== selectedBody.id) return b;
        if (field === 'mass') {
          return { ...b, mass: Math.max(0.001, value) };
        }
        if (field === 'vx') {
          return { ...b, velocity: { ...b.velocity, x: value } };
        }
        if (field === 'vy') {
          return { ...b, velocity: { ...b.velocity, y: value } };
        }
        if (field === 'vz') {
          return { ...b, velocity: { ...b.velocity, z: value } };
        }
        return b;
      })
    );
  };

  return (
    <div
      className={`absolute top-16 right-6 z-20 flex flex-col bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl transition-all duration-300 ${
        isCollapsed ? 'w-64' : 'w-84 max-h-[85vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">OrbiSim Control Deck</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Playback Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 gap-2">
        <button
          onClick={() => setConfig((c) => ({ ...c, paused: !c.paused }))}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
            config.paused
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
          }`}
        >
          {config.paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          {config.paused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => onResetPreset('kepler')}
          className="flex items-center gap-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
          title="Reset Simulation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-xs font-medium bg-slate-950/30">
            <button
              onClick={() => setActiveTab('physics')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'physics'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Physics
            </button>
            <button
              onClick={() => setActiveTab('body')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'body'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bodies
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'metrics'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Invariants
            </button>
          </div>

          {/* Tab Content (Scrollable) */}
          <div className="p-4 overflow-y-auto max-h-[60vh] flex flex-col gap-4 text-xs">
            {/* PHYSICS TAB */}
            {activeTab === 'physics' && (
              <div className="flex flex-col gap-3.5">
                {/* Preset selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    System Configuration Preset
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {Object.entries(PRESETS).map(([key, preset]) => {
                      const isActive = activePreset === key;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectPreset(key)}
                          className={`text-left px-2.5 py-1.5 rounded-md border transition flex items-center justify-between ${
                            isActive
                              ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm shadow-cyan-500/10'
                              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-200 hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                            <span className="font-medium text-xs">{preset.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{preset.bodies.length} bodies</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gravitational Constant G */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-medium">Gravitational Constant (G)</label>
                    <span className="font-mono text-cyan-400">{config.G.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={config.G}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, G: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Time Step dt */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-medium">Time Step (Δt)</label>
                    <span className="font-mono text-cyan-400">{config.timeStep.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0005"
                    max="0.02"
                    step="0.0005"
                    value={config.timeStep}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, timeStep: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Integrator Algorithm */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Integration Algorithm
                  </label>
                  <select
                    value={config.integrator}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        integrator: e.target.value as IntegratorType,
                      }))
                    }
                    className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="symplectic_verlet">Symplectic Verlet (Hamiltonian Preserving)</option>
                    <option value="rk4">Runge-Kutta 4th Order (Classical)</option>
                    <option value="pinn_surrogate">Symplectic PINN Surrogate (JAX/PyTorch)</option>
                  </select>
                </div>

                {/* Trail length */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-medium">Orbital Trail Length</label>
                    <span className="font-mono text-slate-400">{config.trailLength} pts</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={config.trailLength}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, trailLength: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* BODIES TAB: Edit mass m and velocity v0 */}
            {activeTab === 'body' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Select Celestial Body
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {bodies.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBodyId(b.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-medium border flex items-center gap-2 transition ${
                          selectedBody?.id === b.id
                            ? 'bg-slate-800 border-cyan-400 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBody && (
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-slate-200 font-medium pb-2 border-b border-slate-800">
                      <span>{selectedBody.name}</span>
                      <span className="text-[10px] font-mono text-cyan-400">ID: {selectedBody.id}</span>
                    </div>

                    {/* Mass m */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-slate-300">Mass (m)</label>
                        <span className="font-mono text-white">{selectedBody.mass.toFixed(2)}</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedBody.mass}
                        onChange={(e) => handleBodyParamChange('mass', parseFloat(e.target.value) || 0.1)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
                      />
                    </div>

                    {/* Initial Velocity v0 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-300 font-medium">Initial Velocity Vector (v⃗₀)</label>
                      <div className="grid grid-cols-3 gap-1.5 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vx</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.x.toFixed(4))}
                            onChange={(e) => handleBodyParamChange('vx', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vy</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.y.toFixed(4))}
                            onChange={(e) => handleBodyParamChange('vy', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vz</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.z.toFixed(4))}
                            onChange={(e) => handleBodyParamChange('vz', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-center text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* METRICS & INVARIANTS TAB */}
            {activeTab === 'metrics' && (
              <div className="flex flex-col gap-3 font-mono">
                {/* Energy relative error indicator */}
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Hamiltonian Energy Error (ΔE / |E₀|)
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-base font-bold ${
                        metrics.relativeEnergyError < 1e-4
                          ? 'text-emerald-400'
                          : metrics.relativeEnergyError < 1e-2
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {metrics.relativeEnergyError.toExponential(3)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {metrics.relativeEnergyError < 1e-4 ? 'Symplectic Stable' : 'Oscillating'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Total Energy (E)</span>
                    <span className="text-white font-semibold">{metrics.totalEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Initial Energy (E₀)</span>
                    <span className="text-slate-300">{metrics.initialEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Kinetic (T)</span>
                    <span className="text-cyan-400">{metrics.kineticEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Potential (V)</span>
                    <span className="text-amber-400">{metrics.potentialEnergy.toFixed(3)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">||V_cm|| (CM Speed)</span>
                    <span className="text-emerald-400">{metrics.centerOfMassSpeed.toExponential(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">||L|| (Angular Mom)</span>
                    <span className="text-purple-400">{metrics.angularMomentumMagnitude.toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80 text-[11px] flex justify-between">
                  <span className="text-slate-400">Total Steps:</span>
                  <span className="text-slate-200">{metrics.stepCount.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
