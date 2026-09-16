import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Shield,
  Gauge,
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

  // Sliding window buffer for real-time SVG Sparkline of Hamiltonian Error
  const errorHistoryRef = useRef<number[]>([]);
  const [, setSparklineTick] = useState(0);

  useEffect(() => {
    const hist = errorHistoryRef.current;
    hist.push(Math.max(1e-15, metrics.relativeEnergyError));
    if (hist.length > 36) {
      hist.shift();
    }
    setSparklineTick((t) => (t + 1) % 1000);
  }, [metrics.relativeEnergyError, metrics.stepCount]);

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

  // Generate SVG path for the sparkline
  const renderSparklinePath = () => {
    const data = errorHistoryRef.current;
    if (data.length < 2) return { path: '', area: '' };

    const width = 240;
    const height = 40;
    const logData = data.map((v) => Math.log10(v));
    let minLog = Math.min(...logData);
    let maxLog = Math.max(...logData);
    if (maxLog - minLog < 0.2) {
      maxLog += 0.2;
      minLog -= 0.2;
    }

    const points = logData.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const normalized = (val - minLog) / (maxLog - minLog);
      const y = height - normalized * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const path = `M ${points.join(' L ')}`;
    const area = `${path} L ${width},${height} L 0,${height} Z`;
    return { path, area };
  };

  const sparkline = renderSparklinePath();

  return (
    <div
      className={`absolute top-16 right-6 z-20 flex flex-col bg-slate-950/90 backdrop-blur-2xl border border-slate-800/90 rounded-2xl shadow-2xl transition-all duration-300 ${
        isCollapsed ? 'w-64' : 'w-88 max-h-[85vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">OrbiSim Mission Deck</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Playback Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 gap-2">
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
          onClick={() => onResetPreset(activePreset)}
          className="flex items-center gap-1 py-1.5 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/80 transition"
          title="Reset Simulation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800/80 text-xs font-medium bg-slate-950/40">
            <button
              onClick={() => setActiveTab('physics')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'physics'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Physics
            </button>
            <button
              onClick={() => setActiveTab('body')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'body'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bodies
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'metrics'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20 font-semibold'
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
                          className={`text-left px-2.5 py-1.5 rounded-lg border transition flex items-center justify-between ${
                            isActive
                              ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-sm shadow-cyan-500/20'
                              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isActive ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-600'
                              }`}
                            />
                            <span className="font-medium text-xs">{preset.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {preset.bodies.length} bodies
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Adaptive Time-Stepping Toggle */}
                <div className="p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-200 font-medium text-xs">Adaptive Time-Stepping</span>
                    </div>
                    <button
                      onClick={() =>
                        setConfig((c) => ({ ...c, adaptiveTimeStep: !c.adaptiveTimeStep }))
                      }
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        config.adaptiveTimeStep ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          config.adaptiveTimeStep ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Dynamically scales Δt at pericenter close encounters to eliminate numerical ejections.
                  </p>
                  {config.adaptiveTimeStep && metrics.currentAdaptiveDt && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] font-mono text-emerald-400">
                      <span>Effective Δt:</span>
                      <span>{metrics.currentAdaptiveDt.toFixed(5)}</span>
                    </div>
                  )}
                </div>

                {/* Barycentric Drift Reset Toggle */}
                <div className="p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-slate-200 font-medium text-xs">Barycentric Center Lock</span>
                    </div>
                    <button
                      onClick={() =>
                        setConfig((c) => ({ ...c, barycenterReset: !c.barycenterReset }))
                      }
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        config.barycenterReset ? 'bg-purple-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          config.barycenterReset ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Cancels center-of-mass linear velocity (V_cm → 0) preserving system momentum invariance.
                  </p>
                </div>

                {/* Photorealistic HDR Bloom Controls */}
                <div className="p-2.5 bg-slate-900/70 border border-slate-800/90 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-200 font-medium text-xs">Photoreal HDR Bloom</span>
                    </div>
                    <button
                      onClick={() => setConfig((c) => ({ ...c, bloomEnabled: !c.bloomEnabled }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        config.bloomEnabled ? 'bg-amber-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          config.bloomEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {config.bloomEnabled && (
                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-800">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">Bloom Intensity</span>
                        <span className="font-mono text-amber-400">
                          {config.bloomIntensity.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="2.5"
                        step="0.1"
                        value={config.bloomIntensity}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, bloomIntensity: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
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
                    onChange={(e) => setConfig((c) => ({ ...c, G: parseFloat(e.target.value) }))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Base Time Step dt */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-300 font-medium">Base Time Step (Δt)</label>
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
                    Integration Scheme
                  </label>
                  <select
                    value={config.integrator}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        integrator: e.target.value as IntegratorType,
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
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
                            ? 'bg-slate-800 border-cyan-400 text-white shadow-sm shadow-cyan-500/10'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBody && (
                  <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-3">
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
                        onChange={(e) =>
                          handleBodyParamChange('mass', parseFloat(e.target.value) || 0.1)
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 font-mono"
                      />
                    </div>

                    {/* Initial Velocity v0 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-300 font-medium">Velocity Vector (v⃗)</label>
                      <div className="grid grid-cols-3 gap-1.5 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vx</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.x.toFixed(4))}
                            onChange={(e) =>
                              handleBodyParamChange('vx', parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vy</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.y.toFixed(4))}
                            onChange={(e) =>
                              handleBodyParamChange('vy', parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">vz</span>
                          <input
                            type="number"
                            step="0.01"
                            value={Number(selectedBody.velocity.z.toFixed(4))}
                            onChange={(e) =>
                              handleBodyParamChange('vz', parseFloat(e.target.value) || 0)
                            }
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
                {/* Live Hamiltonian Energy Error Card with SVG Sparkline */}
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Hamiltonian Error (ΔH / |H₀|)
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                        metrics.relativeEnergyError < 1e-4
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : metrics.relativeEnergyError < 1e-2
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {metrics.relativeEnergyError < 1e-4
                        ? 'Symplectic Stable'
                        : metrics.relativeEnergyError < 1e-2
                        ? 'Bounded Oscillation'
                        : 'Diverging'}
                    </span>
                  </div>

                  <div className="text-lg font-bold text-white tracking-tight">
                    {metrics.relativeEnergyError.toExponential(3)}
                  </div>

                  {/* Real-time SVG Sparkline */}
                  <div className="w-full h-10 overflow-hidden rounded bg-slate-950/60 relative">
                    {sparkline.path && (
                      <svg className="w-full h-full" viewBox="0 0 240 40" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d={sparkline.area} fill="url(#sparklineGrad)" />
                        <path
                          d={sparkline.path}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Grid metrics */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Total Energy (H)</span>
                    <span className="text-white font-semibold">{metrics.totalEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Initial Energy (H₀)</span>
                    <span className="text-slate-300">{metrics.initialEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Kinetic (T)</span>
                    <span className="text-cyan-400">{metrics.kineticEnergy.toFixed(3)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Potential (V)</span>
                    <span className="text-amber-400">{metrics.potentialEnergy.toFixed(3)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">||V_cm|| (CM Speed)</span>
                    <span className="text-emerald-400">{metrics.centerOfMassSpeed.toExponential(2)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">||L|| (Angular Mom)</span>
                    <span className="text-purple-400">{metrics.angularMomentumMagnitude.toFixed(2)}</span>
                  </div>
                </div>

                {metrics.minDistance !== undefined && (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Min Distance (r_min)</span>
                      <span className="text-cyan-300 font-semibold">{metrics.minDistance.toFixed(3)}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Dynamic Δt</span>
                      <span className="text-emerald-300 font-semibold">
                        {metrics.currentAdaptiveDt ? metrics.currentAdaptiveDt.toFixed(4) : config.timeStep.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800 text-[11px] flex justify-between">
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
