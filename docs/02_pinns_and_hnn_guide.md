# 🧠 Guía Educativa: Redes Neuronales Informadas por la Física (PINNs) & HNNs Simplécticas

Bienvenido a la guía conceptual y matemática sobre la capa de Inteligencia Artificial de **AstroDynamics 3D**. En esta sección se detalla cómo las Redes Neuronales Hamiltonianas (HNN) y las PINNs aproximan la dinámica gravitacional de $N$-cuerpos preservando rigurosamente los invariantes y simetrías canónicas de la física.

---

## 🎯 1. ¿Qué es una Red Neuronal Informada por la Física (PINN)?

Una **PINN** (Physics-Informed Neural Network) es una arquitectura neuronal que, además de aprender de observaciones o estados empíricos, incorpora directamente las **ecuaciones diferenciales parciales y leyes de conservación de la física en su función de pérdida (Loss Function)** mediante diferenciación automática analítica (Autograd).

### Diferencia Estructural Fundamental:

```
[Red Neuronal Tradicional] ───> Minimiza únicamente el error de ajuste a datos (Riesgo de violación física)
[PINN / HNN Simpléctica]   ───> Error de datos + Penalización estricta de residuos físicos (L_symplectic + L_energy)
```

---

## 🏛️ 2. Formulación Hamiltoniana en el Espacio de Fases: $H_{\theta}(q, p)$

En mecánica clásica analítica, el estado instantáneo de un sistema de $N$ partículas en $\mathbb{R}^3$ se representa mediante el vector de estado en el espacio de fases $\mathbf{z} \in \mathbb{R}^{6N}$:

$$
\mathbf{z} = \begin{pmatrix} q \\ p \end{pmatrix} = \begin{pmatrix} \vec{r}_1 \\ \vdots \\ \vec{r}_N \\ \vec{p}_1 \\ \vdots \\ \vec{p}_N \end{pmatrix} \in \mathbb{R}^{6N}
$$

Donde:
- $q = (\vec{r}_1^T, \dots, \vec{r}_N^T)^T \in \mathbb{R}^{3N}$ representa las posiciones generalizadas cartesianas.
- $p = (\vec{p}_1^T, \dots, \vec{p}_N^T)^T \in \mathbb{R}^{3N}$ representa los momentos lineales conjugados ($\vec{p}_i = m_i \vec{v}_i \in \mathbb{R}^3$).

El **Hamiltoniano** $H(q, p)$ describe la energía total del sistema como la suma de energía cinética $T(p)$ y energía potencial $V(q)$:

$$
H(q, p) = T(p) + V(q) = \frac{1}{2} p^T M^{-1} p + V(q)
$$

Donde:
- $T(p) = \frac{1}{2} p^T M^{-1} p = \sum_{i=1}^N \frac{\|\vec{p}_i\|^2}{2 m_i}$ es la energía cinética total.
- $V(q) = -\sum_{1 \le i < j \le N} \frac{G m_i m_j}{\sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}}$ es la energía potencial gravitacional con parámetro de suavizado de Plummer $\epsilon > 0$.
- $M = \operatorname{diag}(m_1, m_1, m_1, \dots, m_N, m_N, m_N) \in \mathbb{R}^{3N \times 3N}$ es la matriz diagonal invertible de masas.

Las **Ecuaciones Canónicas de Hamilton** rigen la evolución temporal del flujo dinámico continuo:

$$
\dot{q} = \frac{\partial H}{\partial p}, \qquad \dot{p} = -\frac{\partial H}{\partial q}
$$

En notación simpléctica compacta:

$$
\dot{\mathbf{z}} = \Omega \nabla_{\mathbf{z}} H(\mathbf{z}), \qquad \text{donde } \Omega = \begin{pmatrix} 0 & I_{3N} \\ -I_{3N} & 0 \end{pmatrix} \in \mathbb{R}^{6N \times 6N}
$$

Dado que $\Omega^T = -\Omega$ y $\Omega^2 = -I_{6N}$, la matriz canónica $\Omega$ es ortogonal y antisimétrica ($\Omega^{-1} = -\Omega = \Omega^T$).

### Aprendizaje Mediante Autodiferenciación

En lugar de predecir posiciones futuras como una caja negra arbitraria, **AstroDynamics 3D** entrena una red neuronal profunda $H_{\theta}(q, p): \mathbb{R}^{6N} \to \mathbb{R}$ parametrizada por pesos $\theta$. 

A partir de la red escalar, las derivadas temporales canónicas se extraen analíticamente mediante Autograd (PyTorch/JAX):

$$
\hat{\dot{q}} = \frac{\partial H_{\theta}}{\partial p}, \qquad \hat{\dot{p}} = -\frac{\partial H_{\theta}}{\partial q}
$$

Para cada partícula $i \in \{1, \dots, N\}$:

$$
\hat{\dot{\vec{r}}}_i = \frac{\partial H_{\theta}}{\partial \vec{p}_i}, \qquad \hat{\dot{\vec{p}}}_i = -\frac{\partial H_{\theta}}{\partial \vec{r}_i}
$$

---

## ⚖️ 3. Función de Pérdida Simpléctica Compuesta (Loss Formulation)

Para garantizar convergencia estricta a la variedad hamiltoniana sin disipación ni ganancia espuria de energía, el módulo [`pinn_surrogate/model.py`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/pinn_surrogate/model.py) implementa la función de pérdida regularizada:

$$
\mathcal{L}_{\text{total}}(\theta) = \mathcal{L}_{\text{symplectic}}(\theta) + \lambda_E \mathcal{L}_{\text{energy}}(\theta)
$$

### A. Pérdida Canónica Simpléctica ($\mathcal{L}_{\text{symplectic}}$)
Penaliza el residuo del campo vectorial canónico frente a las velocidades y fuerzas reales de entrenamiento a lo largo del lote $B$:

$$
\mathcal{L}_{\text{symplectic}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left( \left\| \left. \frac{\partial H_{\theta}}{\partial p} \right|_{(q_k, p_k)} - \dot{q}_k \right\|_2^2 + \left\| \left. \frac{\partial H_{\theta}}{\partial q} \right|_{(q_k, p_k)} + \dot{p}_k \right\|_2^2 \right)
$$

Nótese que el signo positivo en $\left\| \frac{\partial H_\theta}{\partial q} + \dot{p}_k \right\|_2^2$ surge directamente de $\dot{p} = -\frac{\partial H}{\partial q} \iff \frac{\partial H}{\partial q} + \dot{p} = \mathbf{0}$.

### B. Pérdida de Conservación de Energía ($\mathcal{L}_{\text{energy}}$)
Ancla el nivel de referencia de la energía y penaliza la deriva escalar respecto al valor inicial $H_{0,k}$ de cada trayectoria:

$$
\mathcal{L}_{\text{energy}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left( H_{\theta}(q_k, p_k) - H_{0,k} \right)^2
$$

En la clase `SymplecticPINNLoss`, $\lambda_E = 0.01$ (`energy_weight`).

### C. Término Opcional de Momento Angular ($\mathcal{L}_{\text{angular}}$)
Para arquitecturas no separables o coordenadas libres, se puede acoplar una penalización de conservación del momento angular total $\vec{L}$:

$$
\mathcal{L}_{\text{angular}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left\| \vec{L}(q_k, p_k) - \vec{L}_{0,k} \right\|_2^2, \qquad \vec{L}(q_k, p_k) = \sum_{i=1}^N \vec{r}_{i,k} \times \vec{p}_{i,k}
$$

---

## 🔮 4. Preservación del Volumen de Fases: Teorema de Liouville

Una transformación discreta en el espacio de fases $\mathbf{z}_{t+\Delta t} = \Psi_{\Delta t}(\mathbf{z}_t)$ es **simpléctica** si su matriz Jacobiana $J = \frac{\partial \mathbf{z}_{t+\Delta t}}{\partial \mathbf{z}_t} \in \mathbb{R}^{6N \times 6N}$ satisface la condición canónica:

$$
J^T \Omega J = \Omega
$$

Tomando determinantes en ambos miembros y utilizando $\det(\Omega) = \det \begin{pmatrix} 0 & I_{3N} \\ -I_{3N} & 0 \end{pmatrix} = 1$:

$$
\det\left(J^T \Omega J\right) = \det(\Omega) \implies (\det J)^2 \det(\Omega) = \det(\Omega) \implies (\det J)^2 = 1
$$

Dado que para flujos dinámicos continuos $J(0) = I_{6N}$ con $\det(I) = +1$, por continuidad topológica se tiene idénticamente:

$$
\det(J) = 1
$$

### Demostración Rigurosa para el Paso de Euler Simpléctico

En **AstroDynamics 3D**, la red neuronal utiliza una arquitectura **separable** $H(q, p) = T(p) + V(q)$ (`separable=True` en `HamiltonianNN`), donde $\frac{\partial H}{\partial q} = \nabla_q V(q)$ depende únicamente de las posiciones y $\frac{\partial H}{\partial p} = \nabla_p T(p)$ depende únicamente de los momentos.

El paso de Euler simpléctico propaga el estado mediante el esquema semi-implícito:

$$
\begin{aligned}
p_{n+1} &= p_n - \Delta t \, \nabla_q V(q_n) \\
q_{n+1} &= q_n + \Delta t \, \nabla_p T(p_{n+1})
\end{aligned}
$$

Esta transformación global $\Phi: (q_n, p_n) \mapsto (q_{n+1}, p_{n+1})$ se descompone de forma exacta en dos sub-pasos elementales:

1. **Sub-paso 1 (Impulso gravitatorio):** $\Phi_1: \begin{pmatrix} q_n \\ p_n \end{pmatrix} \mapsto \begin{pmatrix} q_n \\ p_{n+1} \end{pmatrix} = \begin{pmatrix} q_n \\ p_n - \Delta t \nabla_q V(q_n) \end{pmatrix}$.  
   Su matriz Jacobiana respecto a $(q_n, p_n)$ es un bloque triangular inferior unipotente:
   $$
   J_1 = \begin{pmatrix} I_{3N} & 0 \\ -\Delta t \nabla_q^2 V(q_n) & I_{3N} \end{pmatrix} \implies \det(J_1) = 1
   $$

2. **Sub-paso 2 (Deriva cinemática):** $\Phi_2: \begin{pmatrix} q_n \\ p_{n+1} \end{pmatrix} \mapsto \begin{pmatrix} q_{n+1} \\ p_{n+1} \end{pmatrix} = \begin{pmatrix} q_n + \Delta t \nabla_p T(p_{n+1}) \\ p_{n+1} \end{pmatrix}$.  
   Su matriz Jacobiana respecto a $(q_n, p_{n+1})$ es un bloque triangular superior unipotente:
   $$
   J_2 = \begin{pmatrix} I_{3N} & \Delta t \nabla_p^2 T(p_{n+1}) \\ 0 & I_{3N} \end{pmatrix} \implies \det(J_2) = 1
   $$

Por la regla de la cadena multivariable, el Jacobiano total $J = \frac{\partial(q_{n+1}, p_{n+1})}{\partial(q_n, p_n)}$ es el producto directo $J = J_2 J_1$:

$$
J = \begin{pmatrix} I_{3N} & \Delta t \nabla_p^2 T \\ 0 & I_{3N} \end{pmatrix} \begin{pmatrix} I_{3N} & 0 \\ -\Delta t \nabla_q^2 V & I_{3N} \end{pmatrix} = \begin{pmatrix} I_{3N} - \Delta t^2 (\nabla_p^2 T)(\nabla_q^2 V) & \Delta t \nabla_p^2 T \\ -\Delta t \nabla_q^2 V & I_{3N} \end{pmatrix}
$$

Evaluando el determinante:

$$
\det(J) = \det(J_2) \cdot \det(J_1) = 1 \cdot 1 = 1
$$

Además, haciendo $A = \nabla_q^2 V$ y $B = \nabla_p^2 T$ (matrices hessianas simétricas, $A^T = A$ y $B^T = B$):

$$
J^T \Omega J = \begin{pmatrix} I - \Delta t^2 AB & -\Delta t A \\ \Delta t B & I \end{pmatrix} \begin{pmatrix} 0 & I \\ -I & 0 \end{pmatrix} \begin{pmatrix} I - \Delta t^2 BA & \Delta t B \\ -\Delta t A & I \end{pmatrix} = \begin{pmatrix} 0 & I \\ -I & 0 \end{pmatrix} = \Omega \quad \blacksquare
$$

Esta condición garantiza analíticamente que la 2-forma simpléctica canónica $\omega = \sum_{i=1}^{3N} dq_i \wedge dp_i$ y el volumen del espacio de fases se conservan con precisión geométrica idéntica a la física clásica continua, erradicando cualquier disipación artificial en órbitas a largo plazo.

---

## 🛠️ Resumen para Desarrolladores

1. **`pinn_surrogate/model.py`:** Define la red `HamiltonianNN` con formulación separable $H(q, p) = T(p) + V(q)$, garantizando que $\det(J) \equiv 1$ y $J^T \Omega J = \Omega$.
2. **`pinn_surrogate/tests/test_pinn_conservation.py`:** Verifica numéricamente mediante `pytest` que el error residual y la deriva energética se mantengan estrictamente acotados a lo largo de $1,000+$ pasos de integración.
