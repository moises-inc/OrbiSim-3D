# Referencia de la API de AstroDynamics 3D

Este documento proporciona especificaciones técnicas completas de las clases, funciones e interfaces públicas de AstroDynamics 3D en C++20, Python y TypeScript.

---

## 1. Biblioteca C++20 (`astrodynamics_core`)

### Espacio de Nombres: `astrodynamics`
Archivo de Cabecera: [`cpp_core/include/nbody_solver.hpp`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/cpp_core/include/nbody_solver.hpp)

#### `struct Vec3`
Representa un vector tridimensional de precisión doble.
- **Campos:** `double x{0.0}`, `double y{0.0}`, `double z{0.0}`
- **Métodos:**
  - `constexpr Vec3 operator+(const Vec3& o) const noexcept`: Suma vectorial.
  - `constexpr Vec3 operator-(const Vec3& o) const noexcept`: Resta vectorial.
  - `constexpr Vec3 operator*(double s) const noexcept`: Multiplicación por escalar.
  - `constexpr Vec3 operator/(double s) const noexcept`: División por escalar.
  - `[[nodiscard]] constexpr double dot(const Vec3& o) const noexcept`: Producto punto $\vec{a} \cdot \vec{b}$.
  - `[[nodiscard]] constexpr Vec3 cross(const Vec3& o) const noexcept`: Producto cruz $\vec{a} \times \vec{b}$.
  - `[[nodiscard]] double norm_sq() const noexcept`: Norma euclidiana al cuadrado $\|\vec{a}\|^2$.
  - `[[nodiscard]] double norm() const noexcept`: Norma euclidiana $\|\vec{a}\|$.

#### `struct Body`
Representa un cuerpo celeste con masa y estado en el espacio de fase.
- **Campos:**
  - `std::string name`: Identificador o nombre del cuerpo.
  - `double mass`: Masa inercial y gravitatoria ($m > 0$).
  - `Vec3 position`: Coordenadas de posición $\vec{r} = (x, y, z)$.
  - `Vec3 velocity`: Vector de velocidad $\vec{v} = (v_x, v_y, v_z)$.

#### `enum class IntegratorType`
- `SymplecticVerlet`: Integrador Verlet Simpléctico (preserva el Hamiltoniano).
- `RungeKutta4`: Integrador Runge-Kutta clásico de 4º orden.

#### `class NBodySystem`
Gestor principal del sistema gravitacional de N cuerpos.
- **Constructor:** `explicit NBodySystem(double G = 1.0, double softening = 1e-5)`
- **Configuración:**
  - `void add_body(const Body& body)`: Agrega una partícula al sistema.
  - `void clear()`: Elimina todos los cuerpos e invalida los buffers de aceleración.
  - `void set_G(double G) noexcept`: Configura la constante gravitacional $G$.
  - `void set_softening(double eps) noexcept`: Configura el parámetro de suavizado de Plummer $\epsilon$.
- **Invariantes y Observables:**
  - `[[nodiscard]] Vec3 center_of_mass() const noexcept`: Calcula $\vec{R}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{r}_i$.
  - `[[nodiscard]] Vec3 center_of_mass_velocity() const noexcept`: Calcula $\vec{V}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{v}_i$.
  - `[[nodiscard]] double kinetic_energy() const noexcept`: Energía cinética total $T = \frac{1}{2} \sum_{i=1}^N m_i \|\vec{v}_i\|^2$.
  - `[[nodiscard]] double potential_energy() const noexcept`: Energía potencial de Plummer total $U = -\sum_{1 \le i < j \le N} \frac{G m_i m_j}{\sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}}$.
  - `[[nodiscard]] double total_energy() const noexcept`: Energía total del Hamiltoniano $H = T + U$.
  - `[[nodiscard]] Vec3 total_angular_momentum() const noexcept`: Momento angular total $\vec{L} = \sum_{i=1}^N m_i (\vec{r}_i \times \vec{v}_i)$.
  - `[[nodiscard]] Vec3 total_linear_momentum() const noexcept`: Momento lineal total $\vec{P}_{\text{tot}} = \sum_{i=1}^N m_i \vec{v}_i$.
- **Pasos de Integración:**
  - `void step_symplectic_verlet(double dt)`: Avanza el sistema en $\Delta t$ con reciclaje de aceleración.
  - `void step_rk4(double dt)`: Avanza el sistema en $\Delta t$ mediante RK4.
  - `void step(double dt, IntegratorType type)`: Despacha el paso según el tipo especificado.
  - `std::vector<TrajectorySnapshot> simulate(...)`: Generador de trayectoria multietapa.

---

## 2. Módulo Python PINN Simpléctico (`pinn_surrogate`)

Módulo: [`pinn_surrogate/model.py`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/pinn_surrogate/model.py)

#### `class HamiltonianNN(torch.nn.Module)`
Red neuronal que parametriza la función escalar de energía Hamiltoniana $H_\theta(q, p)$.
- **Parámetros:**
  - `dim` (*int*): Dimensión espacial por partícula (por defecto `3`).
  - `hidden_dim` (*int*): Cantidad de neuronas por capa oculta (por defecto `128`).
  - `num_layers` (*int*): Número de capas ocultas (por defecto `3`).
  - `activation` (*str*): Función de activación suave (`'tanh'` o `'silu'`).
  - `separable` (*bool*): Si es `True`, modela $H(q, p) = T(p) + V(q)$.
- **Métodos:**
  - `forward(q: torch.Tensor, p: torch.Tensor) -> torch.Tensor`: Calcula la energía escalar.
  - `time_derivatives(q: torch.Tensor, p: torch.Tensor, create_graph: bool = True) -> Tuple[torch.Tensor, torch.Tensor]`: Devuelve el campo canónico $(\dot{q} = \nabla_p H, \dot{p} = -\nabla_q H)$ mediante autograd.

#### `class SymplecticPINNLoss(torch.nn.Module)`
Función de pérdida simpléctica y de conservación de energía.
- **Parámetros:**
  - `energy_weight` (*float*): Factor de regularización $\lambda_E$ (por defecto `0.01`).
- **Métodos:**
  - `forward(...) -> Tuple[torch.Tensor, dict]`: Evalúa $\mathcal{L}_{\text{symplectic}} + \lambda_E \|H - H_0\|^2$ y devuelve métricas detalladas.

#### `symplectic_euler_step(model, q, p, dt) -> Tuple[torch.Tensor, torch.Tensor]`
Propaga un paso temporal preservando la 2-forma simpléctica canónica:
$$p_{n+1} = p_n - \Delta t \nabla_q H(q_n, p_n), \quad q_{n+1} = q_n + \Delta t \nabla_p H(q_n, p_{n+1})$$

#### `rollout_surrogate(model, q0, p0, num_steps, dt) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]`
Genera una trayectoria continua a lo largo de `num_steps` pasos registrando posiciones, momentos y energía.

---

## 3. Módulo Cliente Web TypeScript (`web_ui/src`)

Módulo: [`web_ui/src/physics.ts`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/physics.ts)

#### Tipos Principales (`types.ts`):
- `Vector3D`: `{ x: number, y: number, z: number }`
- `CelestialBody`: Objeto de estado con masa, radio, color, posición, velocidad y estela.
- `SimulationConfig`: Parámetros globales de simulación ($G$, $\Delta t$, $\epsilon$, integrador, longitud de estela).
- `PhysicalMetrics`: Invariantes físicos calculados en tiempo real (error relativo de energía, $V_{cm}$, $L$).

#### Funciones de Simulación:
- `stepSymplecticVerlet(bodies, dt, G, softening): CelestialBody[]`: Integrador Velocity Verlet simpléctico.
- `stepRK4(bodies, dt, G, softening): CelestialBody[]`: Integrador Runge-Kutta de 4º orden.
- `stepPINNSurrogate(bodies, dt, G, softening): CelestialBody[]`: Inferencia simpléctica del modelo surrogate.
- `computeMetrics(bodies, G, softening, initialEnergy, stepCount, simTime): PhysicalMetrics`: Cálculo de telemetría de invariantes a 60 FPS.
- `PRESETS`: Configuraciones astrofísicas predefinidas (`kepler`, `figure8`, `lagrange`).
