# AstroDynamics 3D System Architecture

This document provides an in-depth architectural and mathematical specification of **AstroDynamics 3D**, a hybrid high-performance N-body gravitational simulator and symplectic Physics-Informed Neural Network (PINN) surrogate with interactive 3D WebGL visualization.

---

## 1. Modular Decomposition

AstroDynamics 3D is organized into three decoupled layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 Interactive 3D WebGL Frontend               │
│         (React 19 + TypeScript + Three.js + Tailwind v4)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Trajectory Telemetry          │ Invariant Validation
┌──────────────▼───────────────────────────────▼──────────────┐
│           Symplectic PINN Surrogate (PyTorch / JAX)          │
│   H_θ(q, p) Parametrization | Canonical Autodiff Field      │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Training Ground Truth         │ High-Order Baseline
┌──────────────▼───────────────────────────────▼──────────────┐
│                  C++20 High-Performance Core                │
│    Störmer-Verlet | OpenMP | Branchless AVX2/FMA SIMD       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: High-Performance C++20 Numerical Core (`cpp_core/`)

### 2.1 Physics Model
Interparticle gravitational acceleration is modeled via a Plummer sphere potential:
$$\Phi(r) = -\frac{G M}{\sqrt{r^2 + \epsilon^2}}$$

The pairwise force exerted on body $i$ by body $j$ is:
$$\vec{F}_{ij} = \frac{G m_i m_j (\vec{r}_j - \vec{r}_i)}{\left(\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2\right)^{3/2}}$$

### 2.2 Branchless SIMD Vectorization
In standard implementations, an explicit condition (`if (i == j) continue;`) is used to skip self-interaction. This condition disrupts vector instruction streaming. With Plummer softening ($\epsilon > 0$):
$$\vec{r}_i - \vec{r}_i = \mathbf{0} \implies \vec{a}_{ii} = \frac{G m_i \mathbf{0}}{\left(0 + \epsilon^2\right)^{3/2}} \equiv \mathbf{0}$$
By eliminating the branch, GCC/Clang auto-vectorizes the inner loop into uninterrupted `vfmadd231pd` (AVX2) or `vfmadd213pd` (AVX-512) pipelines.

### 2.3 Symplectic Störmer-Verlet with Acceleration Caching
Velocity Verlet requires two acceleration evaluations in a naive implementation:
1. $\vec{r}(t + \Delta t) = \vec{r}(t) + \vec{v}(t)\Delta t + \frac{1}{2}\vec{a}(t)\Delta t^2$
2. Evaluate $\vec{a}(t + \Delta t)$
3. $\vec{v}(t + \Delta t) = \vec{v}(t) + \frac{1}{2}[\vec{a}(t) + \vec{a}(t + \Delta t)]\Delta t$

By maintaining a persistent cached acceleration vector `cur_acc_`, the value $\vec{a}(t+\Delta t)$ computed in step (2) is recycled as $\vec{a}(t)$ for the next step, cutting execution time by **50%** ($1 \times \mathcal{O}(N^2)$ force evaluations per step instead of 2).

### 2.4 Invariant Conservation Guarantees
- **Center of Mass:** Isolated systems maintain constant linear momentum $\vec{P}_{\text{tot}} = \sum m_i \vec{v}_i$ to machine epsilon ($< 10^{-15}$).
- **Symplectic Structure:** By the Baker-Campbell-Hausdorff (BCH) theorem, Strang splitting preserves an exact shadow Hamiltonian $\tilde{H} = H + \Delta t^2 H_2 + \mathcal{O}(\Delta t^4)$, producing strictly bounded energy oscillations without secular growth.

---

## 3. Layer 2: Symplectic PINN Surrogate (`pinn_surrogate/`)

### 3.1 Mathematical Principles of Hamiltonian Neural Networks
A standard neural network predicting $(\ddot{q})$ directly suffers from non-conservative energy drift. The Symplectic PINN parametrizes the scalar energy function $H_\theta(q, p): \mathbb{R}^{2d} \to \mathbb{R}$ directly.

Canonical phase space derivatives are extracted via autograd:
$$\hat{\dot{q}} = \frac{\partial H_\theta}{\partial p}, \qquad \hat{\dot{p}} = -\frac{\partial H_\theta}{\partial q}$$

### 3.2 Symplectic Loss Formulation
The objective function enforces canonical phase flow while anchoring the potential gauge:
$$\mathcal{L}(\theta) = \frac{1}{B} \sum_{k=1}^B \left( \left\|\frac{\partial H_\theta}{\partial p} - \dot{q}_k\right\|_2^2 + \left\|\frac{\partial H_\theta}{\partial q} + \dot{p}_k\right\|_2^2 \right) + \lambda_E \frac{1}{B}\sum_{k=1}^B \|H_\theta(q_k, p_k) - H_0\|^2$$

Smooth $C^\infty$ activations (`Tanh`, `SiLU`) ensure non-vanishing mixed second derivatives:
$$\frac{\partial^2 H_\theta}{\partial \theta \partial q} \neq 0, \qquad \frac{\partial^2 H_\theta}{\partial \theta \partial p} \neq 0$$

### 3.3 Symplectic Rollout
Trajectories are propagated using Symplectic Euler on the learned vector field:
$$p_{n+1} = p_n - \Delta t \left.\frac{\partial H_\theta}{\partial q}\right|_{(q_n, p_n)}$$
$$q_{n+1} = q_n + \Delta t \left.\frac{\partial H_\theta}{\partial p}\right|_{(q_n, p_{n+1})}$$
Because the transformation Jacobian satisfies $\det J = 1$, the exterior 2-form $\omega = dq \wedge dp$ and Liouville phase space volume are conserved exactly.

---

## 4. Layer 3: Interactive 3D WebGL Visualization (`web_ui/`)

### 4.1 Architecture
- **Framework:** React 19 + TypeScript + Vite.
- **Rendering Pipeline:** Three.js with `ACESFilmicToneMapping`, ambient fill, and central inverse-square point light.
- **Scene Objects:**
  - Procedural starfield: 1,800 randomized points in deep space.
  - Coordinate reference: 40×40 subdivision grid along the ecliptic plane.
  - Celestial bodies: `MeshStandardMaterial` with emissive intensity on stellar objects.
  - Orbital wake: Dynamic `THREE.Line` geometry buffer updated per frame.

### 4.2 Controls & Invariant Monitoring
- **AstroDynamics Mission Deck:** Positioned at `top-16 right-6` with glassmorphism backdrop (`slate-900/90 backdrop-blur-xl`).
- **Telemetry HUD:** Fixed at `bottom-6 left-6` streaming active integrator state, particle counts, and interaction guide.
- **Live Observables:** Computes total energy $E = T + V$, relative error $\Delta E / |E_0|$, center of mass speed $\|V_{cm}\|$, and total angular momentum magnitude $\|L\|$ on each simulation tick.
