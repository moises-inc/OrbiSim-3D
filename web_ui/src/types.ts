export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface CelestialBody {
  id: string;
  name: string;
  mass: number;
  radius: number;
  color: string;
  emissive?: boolean;
  position: Vector3D;
  velocity: Vector3D;
  trail: Vector3D[];
}

export type IntegratorType = 'symplectic_verlet' | 'rk4' | 'pinn_surrogate';

export interface SimulationConfig {
  G: number;
  timeStep: number;
  softening: number;
  integrator: IntegratorType;
  trailLength: number;
  paused: boolean;
  speedMultiplier: number;
}

export interface PhysicalMetrics {
  totalEnergy: number;
  initialEnergy: number;
  relativeEnergyError: number;
  kineticEnergy: number;
  potentialEnergy: number;
  centerOfMassSpeed: number;
  angularMomentumMagnitude: number;
  stepCount: number;
  simulatedTime: number;
}
