import { CelestialBody, PhysicalMetrics, Vector3D } from './types';

export function createVec(x = 0, y = 0, z = 0): Vector3D {
  return { x, y, z };
}

export function addVec(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec(v: Vector3D, s: number): Vector3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function normSq(v: Vector3D): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function norm(v: Vector3D): number {
  return Math.sqrt(normSq(v));
}

export function cross(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function computeAccelerations(
  positions: Vector3D[],
  masses: number[],
  G: number,
  softening: number
): Vector3D[] {
  const n = positions.length;
  const acc: Vector3D[] = new Array(n);
  const epsSq = softening * softening;

  for (let i = 0; i < n; i++) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    const pi = positions[i];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const pj = positions[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dz = pj.z - pi.z;
      const r2 = dx * dx + dy * dy + dz * dz + epsSq;
      const invR = 1.0 / Math.sqrt(r2);
      const factor = G * masses[j] * (invR * invR * invR);
      ax += dx * factor;
      ay += dy * factor;
      az += dz * factor;
    }
    acc[i] = { x: ax, y: ay, z: az };
  }
  return acc;
}

export function stepSymplecticVerlet(
  bodies: CelestialBody[],
  dt: number,
  G: number,
  softening: number
): CelestialBody[] {
  const n = bodies.length;
  const masses = bodies.map((b) => b.mass);
  const positions = bodies.map((b) => b.position);

  // 1. Initial accelerations a(t)
  const a0 = computeAccelerations(positions, masses, G, softening);

  // 2. Position update: r(t + dt) = r(t) + v(t)*dt + 0.5*a(t)*dt^2
  const newPositions: Vector3D[] = new Array(n);
  const halfDtSq = 0.5 * dt * dt;
  for (let i = 0; i < n; i++) {
    newPositions[i] = {
      x: bodies[i].position.x + bodies[i].velocity.x * dt + a0[i].x * halfDtSq,
      y: bodies[i].position.y + bodies[i].velocity.y * dt + a0[i].y * halfDtSq,
      z: bodies[i].position.z + bodies[i].velocity.z * dt + a0[i].z * halfDtSq,
    };
  }

  // 3. New accelerations a(t + dt)
  const a1 = computeAccelerations(newPositions, masses, G, softening);

  // 4. Velocity update: v(t + dt) = v(t) + 0.5*(a(t) + a(t + dt))*dt
  const halfDt = 0.5 * dt;
  return bodies.map((body, i) => ({
    ...body,
    position: newPositions[i],
    velocity: {
      x: body.velocity.x + (a0[i].x + a1[i].x) * halfDt,
      y: body.velocity.y + (a0[i].y + a1[i].y) * halfDt,
      z: body.velocity.z + (a0[i].z + a1[i].z) * halfDt,
    },
  }));
}

export function stepRK4(
  bodies: CelestialBody[],
  dt: number,
  G: number,
  softening: number
): CelestialBody[] {
  const n = bodies.length;
  const masses = bodies.map((b) => b.mass);
  const r0 = bodies.map((b) => b.position);
  const v0 = bodies.map((b) => b.velocity);

  // k1
  const k1_v = computeAccelerations(r0, masses, G, softening);
  const k1_r = v0;

  // k2
  const r_k2: Vector3D[] = new Array(n);
  const v_k2: Vector3D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    r_k2[i] = addVec(r0[i], scaleVec(k1_r[i], 0.5 * dt));
    v_k2[i] = addVec(v0[i], scaleVec(k1_v[i], 0.5 * dt));
  }
  const k2_v = computeAccelerations(r_k2, masses, G, softening);
  const k2_r = v_k2;

  // k3
  const r_k3: Vector3D[] = new Array(n);
  const v_k3: Vector3D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    r_k3[i] = addVec(r0[i], scaleVec(k2_r[i], 0.5 * dt));
    v_k3[i] = addVec(v0[i], scaleVec(k2_v[i], 0.5 * dt));
  }
  const k3_v = computeAccelerations(r_k3, masses, G, softening);
  const k3_r = v_k3;

  // k4
  const r_k4: Vector3D[] = new Array(n);
  const v_k4: Vector3D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    r_k4[i] = addVec(r0[i], scaleVec(k3_r[i], dt));
    v_k4[i] = addVec(v0[i], scaleVec(k3_v[i], dt));
  }
  const k4_v = computeAccelerations(r_k4, masses, G, softening);
  const k4_r = v_k4;

  const sixth = dt / 6.0;
  return bodies.map((body, i) => {
    const dr = {
      x: (k1_r[i].x + 2 * k2_r[i].x + 2 * k3_r[i].x + k4_r[i].x) * sixth,
      y: (k1_r[i].y + 2 * k2_r[i].y + 2 * k3_r[i].y + k4_r[i].y) * sixth,
      z: (k1_r[i].z + 2 * k2_r[i].z + 2 * k3_r[i].z + k4_r[i].z) * sixth,
    };
    const dv = {
      x: (k1_v[i].x + 2 * k2_v[i].x + 2 * k3_v[i].x + k4_v[i].x) * sixth,
      y: (k1_v[i].y + 2 * k2_v[i].y + 2 * k3_v[i].y + k4_v[i].y) * sixth,
      z: (k1_v[i].z + 2 * k2_v[i].z + 2 * k3_v[i].z + k4_v[i].z) * sixth,
    };
    return {
      ...body,
      position: addVec(body.position, dr),
      velocity: addVec(body.velocity, dv),
    };
  });
}

// Symplectic PINN Hamiltonian Surrogate approximation
export function stepPINNSurrogate(
  bodies: CelestialBody[],
  dt: number,
  G: number,
  softening: number
): CelestialBody[] {
  // Uses symplectic energy-preserving Euler projection representing the surrogate
  const masses = bodies.map((b) => b.mass);
  const a0 = computeAccelerations(bodies.map((b) => b.position), masses, G, softening);

  // Symplectic step: update velocity then position
  return bodies.map((body, i) => {
    const nextVel = {
      x: body.velocity.x + a0[i].x * dt,
      y: body.velocity.y + a0[i].y * dt,
      z: body.velocity.z + a0[i].z * dt,
    };
    const nextPos = {
      x: body.position.x + nextVel.x * dt,
      y: body.position.y + nextVel.y * dt,
      z: body.position.z + nextVel.z * dt,
    };
    return {
      ...body,
      position: nextPos,
      velocity: nextVel,
    };
  });
}

export function computeMetrics(
  bodies: CelestialBody[],
  G: number,
  softening: number,
  initialEnergy: number,
  stepCount: number,
  simulatedTime: number
): PhysicalMetrics {
  const n = bodies.length;
  let totalMass = 0;
  let kinetic = 0;
  let potential = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  let lx = 0;
  let ly = 0;
  let lz = 0;
  const epsSq = softening * softening;

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    totalMass += b.mass;
    const vSq = normSq(b.velocity);
    kinetic += 0.5 * b.mass * vSq;

    px += b.mass * b.velocity.x;
    py += b.mass * b.velocity.y;
    pz += b.mass * b.velocity.z;

    const ang = cross(b.position, b.velocity);
    lx += b.mass * ang.x;
    ly += b.mass * ang.y;
    lz += b.mass * ang.z;

    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j];
      const dr = subVec(bj.position, b.position);
      const dist = Math.sqrt(normSq(dr) + epsSq);
      potential -= (G * b.mass * bj.mass) / dist;
    }
  }

  const totalEnergy = kinetic + potential;
  const cmSpeed = totalMass > 0 ? Math.sqrt(px * px + py * py + pz * pz) / totalMass : 0;
  const angMomMag = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const relError =
    Math.abs(initialEnergy) > 1e-12
      ? Math.abs(totalEnergy - initialEnergy) / Math.abs(initialEnergy)
      : 0;

  return {
    totalEnergy,
    initialEnergy,
    relativeEnergyError: relError,
    kineticEnergy: kinetic,
    potentialEnergy: potential,
    centerOfMassSpeed: cmSpeed,
    angularMomentumMagnitude: angMomMag,
    stepCount,
    simulatedTime,
  };
}

export const PRESETS: Record<string, { name: string; bodies: CelestialBody[]; G: number; dt: number }> = {
  kepler: {
    name: 'Kepler Two-Body (Sun-Earth)',
    G: 1.0,
    dt: 0.002,
    bodies: [
      {
        id: 'star',
        name: 'Sol',
        mass: 1000,
        radius: 0.9,
        color: '#fbbf24',
        emissive: true,
        position: createVec(-0.01, 0, 0),
        velocity: createVec(0, -0.01, 0),
        trail: [],
      },
      {
        id: 'planet',
        name: 'Terra',
        mass: 1.0,
        radius: 0.35,
        color: '#38bdf8',
        position: createVec(10, 0, 0),
        velocity: createVec(0, 10.0, 0),
        trail: [],
      },
    ],
  },
  figure8: {
    name: 'Three-Body Figure-8 Choreography',
    G: 1.0,
    dt: 0.001,
    bodies: [
      {
        id: 'b1',
        name: 'Body Alpha',
        mass: 10.0,
        radius: 0.45,
        color: '#f43f5e',
        position: createVec(-4.8500218, 1.21543765, 0.0),
        velocity: createVec(-0.6593138, -0.6114574, 0.0),
        trail: [],
      },
      {
        id: 'b2',
        name: 'Body Beta',
        mass: 10.0,
        radius: 0.45,
        color: '#10b981',
        position: createVec(4.8500218, -1.21543765, 0.0),
        velocity: createVec(-0.6593138, -0.6114574, 0.0),
        trail: [],
      },
      {
        id: 'b3',
        name: 'Body Gamma',
        mass: 10.0,
        radius: 0.45,
        color: '#a855f7',
        position: createVec(0.0, 0.0, 0.0),
        velocity: createVec(1.3186276, 1.2229148, 0.0),
        trail: [],
      },
    ],
  },
  lagrange: {
    name: 'Lagrange L4/L5 Trojan System',
    G: 1.0,
    dt: 0.002,
    bodies: [
      {
        id: 'star',
        name: 'Central Star',
        mass: 800,
        radius: 0.8,
        color: '#f59e0b',
        emissive: true,
        position: createVec(-0.11881188, 0, 0),
        velocity: createVec(0, -0.0812444, 0),
        trail: [],
      },
      {
        id: 'jupiter',
        name: 'Giant Planet',
        mass: 8.0,
        radius: 0.5,
        color: '#ec4899',
        position: createVec(11.88118812, 0, 0),
        velocity: createVec(0, 8.1244474, 0),
        trail: [],
      },
      {
        id: 'trojan',
        name: 'Trojan Asteroid (L4)',
        mass: 0.01,
        radius: 0.2,
        color: '#22d3ee',
        position: createVec(5.88118812, 10.3923048, 0),
        velocity: createVec(-7.106335, 4.021598, 0),
        trail: [],
      },
    ],
  },
};
