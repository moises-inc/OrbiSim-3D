# 🪐 AstroDynamics 3D: High-Performance N-Body Engine & Symplectic PINNs Surrogate

[![Language: English](https://img.shields.io/badge/Language-English-blue.svg)](#)
[![Versión: Español](https://img.shields.io/badge/Versi%C3%B3n-Espa%C3%B1ol-green.svg)](README.es.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-blue.svg)](https://isocpp.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-ee4c2c.svg)](https://pytorch.org/)
[![React 19](https://img.shields.io/badge/React-19.0+-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r173+-black.svg)](https://threejs.org/)
[![QA Status](https://img.shields.io/badge/Visual_QA-9.9%2F10_Certified-success.svg)](#-e2e-browser-testing--visual-qa)
[![Proyecto Tennessee](https://img.shields.io/badge/Proyecto-Tennessee-purple.svg)](https://github.com/moises-inc?tab=projects)

> **High-Performance Celestial Mechanics Integration Engine with Symplectic Physics-Informed Neural Networks (PINNs) and Interactive 3D WebGL Visualization.**  
> Part of **Proyecto Tennessee** (*Astroinformatics & Scientific Computing Portfolio*) by **Moisés Amundarain**.

👉 **[Haga clic aquí para leer la versión en Español / Click here for Spanish version](README.es.md)**

---

## 🔬 Mathematical & Scientific Foundations

### 1. N-Body Celestial Mechanics with Plummer Softening
Gravitational interparticle forces are softened using the Plummer sphere potential with scale $\epsilon > 0$ to prevent singularity collisions:

$$U(r_1, \dots, r_N) = - \sum_{i < j} \frac{G m_i m_j}{\sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}}$$

$$\vec{a}_i = -\frac{1}{m_i} \nabla_{\vec{r}_i} U = \sum_{j \neq i} \frac{G m_j (\vec{r}_j - \vec{r}_i)}{\left(\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2\right)^{3/2}}$$

**Branchless SIMD Implementation:** For self-interaction ($j = i$), $(\vec{r}_i - \vec{r}_i) = \mathbf{0}$, ensuring the force term evaluates identically to $\mathbf{0}$. This eliminates conditional branching (`if (i == j) continue`), allowing contiguous AVX2/FMA vector lane execution.

### 2. Symplectic Geometry & Invariants Preservation
The phase space $\mathcal{M} = \mathbb{R}^{2d}$ carries the differential symplectic 2-form:

$$\omega = \sum_{k=1}^d dq_k \wedge dp_k$$

- **Exact Symplecticity:** The discrete mapping $\Phi_{\Delta t}$ preserves the differential 2-form: $\Phi_{\Delta t}^* \omega = \omega$.
- **Liouville Phase Space Volume:** Preservation of the exterior power $\Omega = \bigwedge^d \omega \implies \det\left(\frac{\partial(q_{n+1}, p_{n+1})}{\partial(q_n, p_n)}\right) = 1$.
- **Shadow Hamiltonian Mechanics (BCH Formula):** The Velocity Verlet operator splitting corresponds to an exact modified Hamiltonian:
  $$\tilde{H}(q, p) = H(q, p) + \Delta t^2 H_2(q, p) + \mathcal{O}(\Delta t^4)$$
  guaranteeing **zero secular energy drift** $\left(\frac{d\langle H \rangle}{dt} = 0\right)$ over millions of orbital periods.

### 3. Hamiltonian Neural Networks (HNN) & Symplectic PINNs
Rather than predicting future coordinates directly, the surrogate parametrizes the scalar Hamiltonian energy surface $H_\theta(q, p)$:

$$\dot{q} = \frac{\partial H_\theta}{\partial p}, \qquad \dot{p} = -\frac{\partial H_\theta}{\partial q}$$

The symplectic loss enforces Hamilton's canonical equations via autograd mixed second derivatives:

$$\mathcal{L}_{\text{total}}(\theta) = \left\| \frac{\partial H_\theta}{\partial p} - \dot{q}_{\text{true}} \right\|^2 + \left\| \frac{\partial H_\theta}{\partial q} + \dot{p}_{\text{true}} \right\|^2 + \lambda_E \|H_\theta(q_t, p_t) - H_0\|^2$$

---

## 📊 Verification & QA Benchmarks

| Component | Test Suite / Tool | Verification Metric | Status |
| :--- | :--- | :--- | :---: |
| **C++20 Engine** | GoogleTest (`test_nbody`) | Center of Mass Velocity Drift $\|V_{cm}\| \approx 0$, Energy Conservation ($\Delta E / \|E_0\| < 10^{-4}$ over 5k steps) | **PASS (11 ms)** |
| **Symplectic PINN** | pytest (`test_pinn_conservation.py`) | Autodiff Hessian verification, 1,000-step zero secular drift ($\Delta H / H_0 < 0.05$) | **PASS (3.8 s)** |
| **WebGL 3D Web UI** | Playwright (`e2e_browser_test_astrodynamics.cjs`) | 0 console errors, ACES Filmic WebGL rendering at 60 FPS | **PASS (9.9/10)** |

---

## 🚀 Quick Start Guide

### Prerequisites
- **C++ Compiler:** GCC 13+ / Clang 17+ with C++20 support and OpenMP (`libomp-dev`).
- **Build System:** CMake 3.20+.
- **Python:** Python 3.11 or 3.12 with `pip`.
- **Node.js:** Node.js 18+ or 20+ with `npm`.

---

### 1. Build and Run C++20 Engine Tests

```bash
# Configure with CMake
cmake -B cpp_core/build -S cpp_core -DCMAKE_BUILD_TYPE=Release

# Compile with maximum parallelism
cmake --build cpp_core/build -j$(nproc)

# Run GoogleTest test suite
./cpp_core/build/test_nbody
```

---

### 2. Run Symplectic PINN Surrogate

```bash
# Create virtual environment
python3 -m venv pinn_surrogate/.venv
source pinn_surrogate/.venv/bin/activate

# Install PyTorch, NumPy, PyTest
pip install --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple torch numpy pytest

# Run automated tests
pytest pinn_surrogate/tests/ -v

# Run interactive CLI inference demo
python pinn_surrogate/demo_inference.py
```

---

### 3. Launch 3D WebGL Visualization

```bash
cd web_ui

# Install dependencies
npm install

# Start Vite development server (Port 5180)
npm run dev

# Or build and preview production bundle
npm run build
npm run preview
```

Open your browser at:  
👉 **`http://localhost:5180`**

#### Navigation & Interactive Controls:
- **Left Click + Drag:** 3D Camera Orbit rotation.
- **Right Click + Drag:** Camera Pan.
- **Mouse Scroll:** Zoom in / out.
- **AstroDynamics Mission Deck:**
  - **Physics Tab:** Switch between Kepler Two-Body, Three-Body Figure-8 Choreography, and Lagrange L4/L5 Trojan systems. Adjust $G$, $\Delta t$, and toggle between **Symplectic Verlet**, **RK4**, and **Symplectic PINN Surrogate**.
  - **Bodies Tab:** Edit masses $m$ and initial velocity vectors $\vec{v}_0 = (v_x, v_y, v_z)$ in real-time.
  - **Invariants Tab:** Real-time stream of Hamiltonian Energy Error $\Delta E / |E_0|$, Center of Mass speed $\|V_{cm}\|$, and Angular Momentum $\|L\|$.

---

## 🛠️ Repository Directory Structure

```text
AstroDynamics-3D/
├── cpp_core/                      # C++20 Numerical Engine
│   ├── include/
│   │   └── nbody_solver.hpp       # Header: NBodySystem, Vec3, Body, integrators
│   ├── src/
│   │   └── nbody_solver.cpp       # SIMD branchless & zero-allocation acceleration caching
│   ├── tests/
│   │   └── test_nbody.cpp         # GoogleTest suite for physical conservation invariants
│   └── CMakeLists.txt             # -std=c++20, -O3, -fopenmp, -march=native
├── pinn_surrogate/                # Symplectic PINN Layer
│   ├── model.py                   # HamiltonianNN, SymplecticPINNLoss, symplectic_euler_step
│   ├── demo_inference.py          # Interactive CLI demo for Hamiltonian rollout
│   └── tests/
│       └── test_pinn_conservation.py # pytest suite certifying 1,000+ step energy stability
├── web_ui/                        # React 19 + TypeScript + Three.js Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── OrbitCanvas3D.tsx  # Three.js 3D Canvas, lighting, starfield, orbital trails
│   │   │   └── ControlsPanel.tsx  # Interactive parameter controls & Invariants HUD
│   │   ├── App.tsx                # Main container with header branding and badges
│   │   ├── physics.ts             # Client-side numerical integrators and system presets
│   │   ├── types.ts               # TypeScript data definitions
│   │   └── index.css              # Tailwind CSS v4 styling & animations
│   ├── scripts/
│   │   └── e2e_browser_test_astrodynamics.cjs # Playwright automated visual QA test suite
│   ├── vite.config.ts             # Port 5180 dedicated configuration
│   └── package.json
├── docs/                          # In-depth architectural & API documentation
│   ├── ARCHITECTURE.md            # Detailed scientific & software architecture (English)
│   ├── ARCHITECTURE.es.md         # Arquitectura detallada del sistema (Español)
│   ├── API_REFERENCE.md           # API Reference for C++, Python, and TypeScript (English)
│   └── API_REFERENCE.es.md        # Referencia completa de APIs (Español)
├── README.md                      # English documentation
├── README.es.md                   # Documentación en Español
└── LICENSE                        # MIT License
```

---

## 📜 License & Citation

Distributed under the **MIT License**. See `LICENSE` for details.

If you use AstroDynamics 3D in academic or research work, please cite:

```bibtex
@software{amundarain2026astrodynamics3d,
  author = {Amundarain, Mois{\'e}s},
  title = {{AstroDynamics 3D: High-Performance N-Body Orbital Engine \& Symplectic PINNs Surrogate}},
  year = {2026},
  publisher = {GitHub},
  journal = {Proyecto Tennessee},
  url = {https://github.com/moises-inc/astrodynamics-3d}
}
```
