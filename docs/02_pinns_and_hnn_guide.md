# 🧠 Guía Educativa: Redes Neuronales Informadas por la Física (PINNs) & HNNs Simplécticas

Bienvenido a la guía conceptual y matemática sobre la capa de Inteligencia Artificial de **AstroDynamics 3D**. En esta sección se detalla cómo las Redes Neuronales Hamiltonianas (HNN) y las PINNs aproximan la dinámica gravitacional de $N$-cuerpos preservando rigurosamente las invariantes y simetrías canónicas de la física.

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
- $q \in \mathbb{R}^{3N}$ representa las posiciones generalizadas.
- $p \in \mathbb{R}^{3N}$ representa los momentos lineales conjugados ($p_i = m_i \vec{v}_i$).

El **Hamiltoniano** $H(q, p)$ representa la energía total del sistema (cinética $T$ más potencial $V$):

$$
H(q, p) = T(p) + V(q) = \frac{1}{2} p^T M^{-1} p + V(q)
$$

Donde $M = \operatorname{diag}(m_1, m_1, m_1, \dots, m_N, m_N, m_N) \in \mathbb{R}^{3N \times 3N}$ es la matriz diagonal de masas.

Las **Ecuaciones Canónicas de Hamilton** rigen la evolución temporal del flujo dinámico:

$$
\dot{q} = \frac{\partial H}{\partial p}, \qquad \dot{p} = -\frac{\partial H}{\partial q}
$$

En notación simpléctica compacta:

$$
\dot{\mathbf{z}} = \Omega \nabla_{\mathbf{z}} H(\mathbf{z}), \qquad \text{donde } \Omega = \begin{pmatrix} 0 & I_{3N} \\ -I_{3N} & 0 \end{pmatrix} \in \mathbb{R}^{6N \times 6N}
$$

### Aprendizaje Mediante Autodiferenciación

En lugar de predecir posiciones futuras directamente como una caja negra, **AstroDynamics 3D** entrena una red neuronal profunda $H_{\theta}(q, p): \mathbb{R}^{6N} \to \mathbb{R}$ parametrizada por pesos $\theta$. 

A partir de la red escalar, las derivadas temporales canónicas se extraen analíticamente mediante Autograd (PyTorch/JAX):

$$
\hat{\dot{q}} = \frac{\partial H_{\theta}}{\partial p}, \qquad \hat{\dot{p}} = -\frac{\partial H_{\theta}}{\partial q}
$$

---

## ⚖️ 3. Función de Pérdida Simpléctica Compuesta (Loss Formulation)

Para garantizar convergencia estricta a la variedad hamiltoniana sin ganancia ni pérdida artificial de energía, se formula la función de pérdida multiobjetivo:

$$
\mathcal{L}_{\text{total}}(\theta) = \mathcal{L}_{\text{symplectic}}(\theta) + \lambda_L \mathcal{L}_{\text{angular}}(\theta) + \lambda_E \mathcal{L}_{\text{energy}}(\theta)
$$

Donde:

### A. Pérdida Canónica Simpléctica ($\mathcal{L}_{\text{symplectic}}$)
Penaliza la discrepancia entre el campo vectorial inducido por el gradiente de la red y las derivadas reales:

$$
\mathcal{L}_{\text{symplectic}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left( \left\| \frac{\partial H_{\theta}}{\partial p}(q_k, p_k) - \dot{q}_k \right\|_2^2 + \left\| \frac{\partial H_{\theta}}{\partial q}(q_k, p_k) + \dot{p}_k \right\|_2^2 \right)
$$

### B. Pérdida de Conservación del Momento Angular ($\mathcal{L}_{\text{angular}}$)
Garantiza la isotropía espacial $SO(3)$:

$$
\mathcal{L}_{\text{angular}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left\| \vec{L}(q_k, p_k) - \vec{L}_0 \right\|_2^2, \qquad \text{con } \vec{L}(q_k, p_k) = \sum_{i=1}^N \vec{r}_{i,k} \times \vec{p}_{i,k}
$$

### C. Pérdida de Conservación de Energía ($\mathcal{L}_{\text{energy}}$)
Fija la invariancia del valor de la energía inicial $H_0$:

$$
\mathcal{L}_{\text{energy}}(\theta) = \frac{1}{B} \sum_{k=1}^B \left| H_{\theta}(q_k, p_k) - H_0 \right|^2
$$

---

## 🔮 4. Preservación del Volumen de Fases: Teorema de Liouville

Una transformación discreta en el espacio de fases $\mathbf{z}_{t+\Delta t} = \Psi_{\Delta t}(\mathbf{z}_t)$ es **simpléctica** si su matriz Jacobiana $J = \frac{\partial \mathbf{z}_{t+\Delta t}}{\partial \mathbf{z}_t}$ satisface la condición canónica:

$$
J^T \Omega J = \Omega
$$

Tomando determinantes en ambos miembros:

$$
\det\left(J^T \Omega J\right) = \det(\Omega) \implies (\det J)^2 \det(\Omega) = \det(\Omega) \implies (\det J)^2 = 1
$$

Dado que para transformaciones dinámicas continuas conectadas con la identidad $J(0) = I$, se concluye que:

$$
\det(J) = 1
$$

### Demostración para el Paso de Euler Simpléctico

Al integrar el campo aprendido con el integrador simpléctico:

$$
\begin{aligned}
p_{n+1} &= p_n - \Delta t \left.\frac{\partial H_{\theta}}{\partial q}\right|_{(q_n, p_n)} \\
q_{n+1} &= q_n + \Delta t \left.\frac{\partial H_{\theta}}{\partial p}\right|_{(q_n, p_{n+1})}
\end{aligned}
$$

El Jacobiano global de la transformación se descompone en el producto de dos matrices triangulares unipotentes de cizalla (shear):

$$
J = \begin{pmatrix} I & \Delta t \frac{\partial^2 H_\theta}{\partial p^2} \\ 0 & I \end{pmatrix} \begin{pmatrix} I & 0 \\ -\Delta t \frac{\partial^2 H_\theta}{\partial q^2} & I \end{pmatrix} \implies \det(J) = 1 \cdot 1 = 1
$$

Esta condición algebraica garantiza que la 2-forma simpléctica $\omega = dq \wedge dp$ y el volumen del espacio de fases se conserven con exactitud matemática, erradicando cualquier decaimiento artificial de las órbitas.

---

## 🛠️ Resumen para Desarrolladores

1. **`pinn_surrogate/model.py`:** Define la red `HamiltonianNN` con soporte para formulación separable $H(q, p) = T(p) + V(q)$, garantizando derivadas de Liouville exactas.
2. **`pinn_surrogate/tests/test_pinn_conservation.py`:** Verifica numéricamente mediante `pytest` que el error residual y la deriva energética se mantengan acotados a lo largo de $1,000+$ pasos de integración.
