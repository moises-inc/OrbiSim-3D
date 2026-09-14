# Arquitectura del Sistema OrbiSim-3D

Este documento proporciona una especificación técnica, arquitectónica y matemática exhaustiva de **OrbiSim-3D**, un simulador gravitacional híbrido de N cuerpos con capa surrogate PINN simpléctica y visualización interactiva WebGL 3D.

---

## 1. Descomposición Modular del Sistema

OrbiSim-3D está estructurado en tres capas desacopladas e interoperables:

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend WebGL 3D Interactivo               │
│         (React 19 + TypeScript + Three.js + Tailwind v4)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Telemetría de Trayectorias    │ Validación de Invariantes
┌──────────────▼───────────────────────────────▼──────────────┐
│           Capa PINN Simpléctica (PyTorch / JAX)              │
│   Parametrización H_θ(q, p) | Campo Canónico Autodif         │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Datos de Entrenamiento        │ Línea Base de Alta Precisión
┌──────────────▼───────────────────────────────▼──────────────┐
│                  Núcleo C++20 de Alto Rendimiento            │
│    Störmer-Verlet | OpenMP | SIMD AVX2/FMA sin bifurcación   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Capa 1: Núcleo Numérico C++20 (`cpp_core/`)

### 2.1 Modelo Gravitacional con Suavizado
La interacción gravitacional entre partículas se modela mediante el potencial de la esfera de Plummer con longitud de escala $\epsilon > 0$:
$$\Phi(r) = -\frac{G M}{\sqrt{r^2 + \epsilon^2}}$$

La fuerza ejercida sobre el cuerpo $i$ por el cuerpo $j$ es:
$$\vec{F}_{ij} = \frac{G m_i m_j (\vec{r}_j - \vec{r}_i)}{\left(\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2\right)^{3/2}}$$

### 2.2 Vectorización SIMD Branchless
En implementaciones convencionales, se utiliza una condición explícita (`if (i == j) continue;`) para omitir la auto-interacción. Dicha bifurcación interrumpe el flujo vectorial en las unidades SIMD. Con el suavizado de Plummer ($\epsilon > 0$):
$$\vec{r}_i - \vec{r}_i = \mathbf{0} \implies \vec{a}_{ii} = \frac{G m_i \mathbf{0}}{\left(0 + \epsilon^2\right)^{3/2}} \equiv \mathbf{0}$$
Al suprimir la condición, los compiladores GCC y Clang vectorizan de forma ininterrumpida el bucle interno mediante instrucciones FMA contiguas (`vfmadd231pd`).

### 2.3 Verlet Simpléctico con Caché de Aceleraciones
El algoritmo Velocity Verlet requiere calcular dos aceleraciones en su versión directa:
1. $\vec{r}(t + \Delta t) = \vec{r}(t) + \vec{v}(t)\Delta t + \frac{1}{2}\vec{a}(t)\Delta t^2$
2. Evaluar $\vec{a}(t + \Delta t)$
3. $\vec{v}(t + \Delta t) = \vec{v}(t) + \frac{1}{2}[\vec{a}(t) + \vec{a}(t + \Delta t)]\Delta t$

Al mantener un buffer persistente `cur_acc_`, la aceleración calculada en el paso (2) se recicla en el siguiente ciclo temporal como $\vec{a}(t)$, reduciendo en un **50%** el costo computacional total.

### 2.4 Invariantes Físicos Conservados
- **Centro de Masa:** En sistemas aislados, el momento lineal total $\vec{P} = \sum m_i \vec{v}_i$ se preserva a nivel de precisión de máquina ($< 10^{-15}$).
- **Estructura Simpléctica:** Por el teorema de Baker-Campbell-Hausdorff (BCH), el integrador de Verlet preserva exactamente un Hamiltoniano sombra $\tilde{H} = H + \Delta t^2 H_2 + \mathcal{O}(\Delta t^4)$, lo que asegura oscilaciones de energía acotadas sin divergencia secular.

---

## 3. Capa 2: Capa PINN Simpléctica (`pinn_surrogate/`)

### 3.1 Principios de Redes Neuronales Hamiltonianas
Aprender aceleraciones directamente mediante redes neuronales convencionales conduce a disipación o inestabilidad energética artificial. La red neuronal hamiltoniana modela directamente el escalar de energía total $H_\theta(q, p): \mathbb{R}^{2d} \to \mathbb{R}$.

Las derivadas canónicas se obtienen analíticamente por autodiferenciación:
$$\hat{\dot{q}} = \frac{\partial H_\theta}{\partial p}, \qquad \hat{\dot{p}} = -\frac{\partial H_\theta}{\partial q}$$

### 3.2 Formulación de la Pérdida Simpléctica
$$\mathcal{L}(\theta) = \frac{1}{B} \sum_{k=1}^B \left( \left\|\frac{\partial H_\theta}{\partial p} - \dot{q}_k\right\|_2^2 + \left\|\frac{\partial H_\theta}{\partial q} + \dot{p}_k\right\|_2^2 \right) + \lambda_E \frac{1}{B}\sum_{k=1}^B \|H_\theta(q_k, p_k) - H_0\|^2$$

El uso de funciones de activación $C^\infty$ (`Tanh`, `SiLU`) asegura derivadas segundas mixtas continuas sin desaparición del gradiente durante el entrenamiento.

### 3.3 Integración Simpléctica
Las trayectorias se propagan utilizando Euler Simpléctico sobre el campo aprendido:
$$p_{n+1} = p_n - \Delta t \left.\frac{\partial H_\theta}{\partial q}\right|_{(q_n, p_n)}$$
$$q_{n+1} = q_n + \Delta t \left.\frac{\partial H_\theta}{\partial p}\right|_{(q_n, p_{n+1})}$$
Dado que el determinante jacobiano satisface $\det J = 1$, la 2-forma simpléctica $\omega = dq \wedge dp$ y el volumen del espacio de fase de Liouville se conservan con precisión geométrica.

---

## 4. Capa 3: Frontend WebGL 3D Interactivo (`web_ui/`)

### 4.1 Arquitectura del Cliente
- **Base Tecnológica:** React 19 + TypeScript + Vite.
- **Pipeline de Renderizado:** Three.js con mapeo de tonos `ACESFilmicToneMapping`, luz ambiental difusa y fuente puntual central con atenuación cuadrática.
- **Elementos de la Escena:**
  - Campo estelar procedural: 1,800 partículas en coordenadas aleatorias.
  - Rejilla de referencia: Plano orbital con subdivisión de 40×40 unidades.
  - Cuerpos celestes: Mallas esféricas con materiales PBR y brillo emisivo estelar.
  - Estelas orbitales: Geometría dinámica `BufferGeometry` actualizada cuadro a cuadro.

### 4.2 Controles e Invariantes
- **OrbiSim Control Deck:** Ubicado en `top-16 right-6` con acabado glassmorphism (`slate-900/90 backdrop-blur-xl`).
- **HUD de Telemetría:** Anclado en `bottom-6 left-6` transmitiendo el estado del integrador, conteo de partículas y guía de interacción.
- **Observables en Tiempo Real:** Cálculo simultáneo a 60 FPS de la energía total $E = T + V$, error relativo $\Delta E / |E_0|$, velocidad del centro de masa $\|V_{cm}\|$, y momento angular total $\|L\|$.
