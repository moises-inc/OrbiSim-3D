# AstroDynamics 3D API Reference

This document provides complete technical specifications for the public classes, functions, and interfaces in AstroDynamics 3D across C++20, Python, and TypeScript.

---

## 1. C++20 Core Library (`astrodynamics_core`)

### Namespace: `astrodynamics`
Header: [`cpp_core/include/nbody_solver.hpp`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/cpp_core/include/nbody_solver.hpp)

#### `struct Vec3`
Represents a 3D vector of double-precision floating-point coordinates.
- **Fields:** `double x{0.0}`, `double y{0.0}`, `double z{0.0}`
- **Methods:**
  - `constexpr Vec3 operator+(const Vec3& o) const noexcept`: Vector addition.
  - `constexpr Vec3 operator-(const Vec3& o) const noexcept`: Vector subtraction.
  - `constexpr Vec3 operator*(double s) const noexcept`: Scalar multiplication.
  - `constexpr Vec3 operator/(double s) const noexcept`: Scalar division.
  - `[[nodiscard]] constexpr double dot(const Vec3& o) const noexcept`: Dot product $\vec{a} \cdot \vec{b}$.
  - `[[nodiscard]] constexpr Vec3 cross(const Vec3& o) const noexcept`: Cross product $\vec{a} \times \vec{b}$.
  - `[[nodiscard]] double norm_sq() const noexcept`: Squared Euclidean norm $\|\vec{a}\|^2$.
  - `[[nodiscard]] double norm() const noexcept`: Euclidean norm $\|\vec{a}\|$.

#### `struct Body`
Represents an astronomical body with mass and phase space state.
- **Fields:**
  - `std::string name`: Descriptive label.
  - `double mass`: Inertial and gravitational mass ($m > 0$).
  - `Vec3 position`: Coordinates $\vec{r} = (x, y, z)$.
  - `Vec3 velocity`: Velocity vector $\vec{v} = (v_x, v_y, v_z)$.

#### `enum class IntegratorType`
- `SymplecticVerlet`: Symplectic Störmer-Verlet integrator (Hamiltonian-preserving).
- `RungeKutta4`: Classical 4th-order Runge-Kutta integrator.

#### `class NBodySystem`
Main N-body integration and simulation manager.
- **Constructor:** `explicit NBodySystem(double G = 1.0, double softening = 1e-5)`
- **Configuration:**
  - `void add_body(const Body& body)`: Adds a particle to the system.
  - `void clear()`: Removes all bodies and invalidates caches.
  - `void set_G(double G) noexcept`: Sets the gravitational constant $G$.
  - `void set_softening(double eps) noexcept`: Sets the Plummer softening parameter $\epsilon$.
- **Observables & Invariants:**
  - `[[nodiscard]] Vec3 center_of_mass() const noexcept`: Computes $\vec{R}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{r}_i$.
  - `[[nodiscard]] Vec3 center_of_mass_velocity() const noexcept`: Computes $\vec{V}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{v}_i$.
  - `[[nodiscard]] double kinetic_energy() const noexcept`: Total kinetic energy $T = \frac{1}{2} \sum_{i=1}^N m_i \|\vec{v}_i\|^2$.
  - `[[nodiscard]] double potential_energy() const noexcept`: Total Plummer potential energy $U = -\sum_{1 \le i < j \le N} \frac{G m_i m_j}{\sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}}$.
  - `[[nodiscard]] double total_energy() const noexcept`: Total Hamiltonian energy $H = T + U$.
  - `[[nodiscard]] Vec3 total_angular_momentum() const noexcept`: Total angular momentum $\vec{L} = \sum_{i=1}^N m_i (\vec{r}_i \times \vec{v}_i)$.
  - `[[nodiscard]] Vec3 total_linear_momentum() const noexcept`: Total linear momentum $\vec{P}_{\text{tot}} = \sum_{i=1}^N m_i \vec{v}_i$.
- **Integration Steps:**
  - `void step_symplectic_verlet(double dt)`: Advances state by $\Delta t$ with cached acceleration.
  - `void step_rk4(double dt)`: Advances state by $\Delta t$ via RK4.
  - `void step(double dt, IntegratorType type = IntegratorType::SymplecticVerlet)`: Dispatches step by type.
  - `std::vector<TrajectorySnapshot> simulate(double total_time, double dt, IntegratorType type, size_t interval)`: Multi-step trajectory generator.

---

## 2. Python PINN Surrogate Module (`pinn_surrogate`)

Module: [`pinn_surrogate/model.py`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/pinn_surrogate/model.py)

#### `class HamiltonianNN(torch.nn.Module)`
Neural network parametrizing scalar Hamiltonian energy $H_\theta(q, p)$.
- **Parameters:**
  - `dim` (*int*): Coordinate dimension per particle (default `3`).
  - `hidden_dim` (*int*): Hidden layer neuron count (default `128`).
  - `num_layers` (*int*): Layer depth (default `3`).
  - `activation` (*str*): Smooth activation function (`'tanh'` or `'silu'`).
  - `separable` (*bool*): If `True`, models $H(q, p) = T(p) + V(q)$.
- **Methods:**
  - `forward(q: torch.Tensor, p: torch.Tensor) -> torch.Tensor`: Computes scalar Hamiltonian energy.
  - `time_derivatives(q: torch.Tensor, p: torch.Tensor, create_graph: bool = True) -> Tuple[torch.Tensor, torch.Tensor]`: Returns autodiff canonical vector field $(\dot{q} = \nabla_p H, \dot{p} = -\nabla_q H)$.

#### `class SymplecticPINNLoss(torch.nn.Module)`
Symplectic and energy conservation loss function.
- **Parameters:**
  - `energy_weight` (*float*): Regularization factor $\lambda_E$ (default `0.01`).
- **Methods:**
  - `forward(model, q, p, q_dot_true, p_dot_true, h0_true=None) -> Tuple[torch.Tensor, dict]`: Evaluates $\mathcal{L}_{\text{symplectic}} + \lambda_E \|H - H_0\|^2$ and returns metrics.

#### `symplectic_euler_step(model, q, p, dt) -> Tuple[torch.Tensor, torch.Tensor]`
Propagates state by one discrete step preserving the canonical symplectic 2-form:
$$p_{n+1} = p_n - \Delta t \nabla_q H(q_n, p_n), \quad q_{n+1} = q_n + \Delta t \nabla_p H(q_n, p_{n+1})$$

#### `rollout_surrogate(model, q0, p0, num_steps, dt) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]`
Rolls out trajectory over `num_steps` steps and tracks state and energy history.

---

## 3. TypeScript Web Client Module (`web_ui/src`)

Module: [`web_ui/src/physics.ts`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/physics.ts)

#### Types (`types.ts`):
- `Vector3D`: `{ x: number, y: number, z: number }`
- `CelestialBody`: State object with mass, radius, color, coordinates, velocity, and trail history.
- `SimulationConfig`: Global parameters ($G$, $\Delta t$, $\epsilon$, integrator, trail length, paused status).
- `PhysicalMetrics`: Invariants metrics (energy error, total energy, kinetic, potential, $V_{cm}$, $L$).

#### Functions:
- `stepSymplecticVerlet(bodies, dt, G, softening): CelestialBody[]`: Symplectic Velocity Verlet integrator.
- `stepRK4(bodies, dt, G, softening): CelestialBody[]`: Classical 4th-order Runge-Kutta integrator.
- `stepPINNSurrogate(bodies, dt, G, softening): CelestialBody[]`: Symplectic surrogate rollout.
- `computeMetrics(bodies, G, softening, initialEnergy, stepCount, simTime): PhysicalMetrics`: Calculates real-time telemetry metrics.
- `PRESETS`: Pre-configured astrophysical systems (`kepler`, `figure8`, `lagrange`).
