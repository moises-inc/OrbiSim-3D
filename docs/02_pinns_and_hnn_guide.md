# 🧠 Guía Educativa: Redes Neuronales Informadas por la Física (PINNs) & HNNs Simplécticas

Bienvenido a la guía conceptual sobre la capa de Inteligencia Artificial de **AstroDynamics 3D**. En esta sección aprenderás cómo las Redes Neuronales Hamiltonianas (HNN) y las PINNs permiten aproximar la dinámica de $N$-cuerpos conservando estrictamente las leyes de la física.

---

## 🎯 1. ¿Qué es una Red Neuronal Informada por la Física (PINN)?

Una **PINN** (Physics-Informed Neural Network) es una red neuronal convencional que no solo aprende de datos empíricos u observaciones, sino que incorpora las **ecuaciones diferenciales de la física directamente en su función de pérdida (Loss Function)** mediante autodiferenciación estática (Autograd).

### Diferencia Fundamental:

```
[Red Neuronal Tradicional] ───> Maximiza ajuste solo a datos (Riesgo de violar la física)
[PINN / HNN Simpléctica]   ───> Minimiza error de datos + Penaliza violación de conservación (L_physics)
```

---

## 🏛️ 2. Formulación Hamiltoniana: $H_{\theta}(q, p)$

En mecánica clásica, el estado de un sistema con $N$ partículas en espacio 3D se describe mediante coordenadas generalizadas de posición $q \in \mathbb{R}^{3N}$ y momentos conjugados $p \in \mathbb{R}^{3N}$.

El **Hamiltoniano** $H(q, p)$ representa la energía total del sistema:

$$H(q, p) = T(p) + V(q) = \frac{1}{2} p^T M^{-1} p + V(q)$$

Las **Ecuaciones de Hamilton** rigen la evolución temporal del sistema:

$$\dot{q} = \frac{\partial H}{\partial p}, \quad \dot{p} = -\frac{\partial H}{\partial q}$$

### ¿Cómo lo aprende la Red Neuronal?
En lugar de entrenar una red para predecir directamente las posiciones futuras $\hat{q}_{t+1}$, **AstroDynamics 3D** entrena una red $H_{\theta}(q, p)$ parametrizada por pesos $\theta$ que aprende la función escalar de energía del sistema. 

Luego, mediante **Autodiferenciación (JAX / PyTorch)**, derivamos analíticamente $H_{\theta}$ con respecto a $q$ y $p$ para obtener las derivadas de velocidad y fuerza:

$$\hat{\dot{q}} = \frac{\partial H_{\theta}}{\partial p}, \quad \hat{\dot{p}} = -\frac{\partial H_{\theta}}{\partial q}$$

---

## ⚖️ 3. Función de Pérdida Simpléctica (Symplectic Loss)

Para garantizar que la red aprenda la dinámica conservativa exacta sin deriva temporal ni ganancia artificial de energía, se define la pérdida simpléctica:

$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{symplectic}} + \lambda_L \mathcal{L}_{\text{angular}} + \lambda_H \mathcal{L}_{\text{energy}}$$

Donde:
- **Pérdida Simpléctica:**
  $$\mathcal{L}_{\text{symplectic}} = \left\| \frac{\partial H_{\theta}}{\partial p} - \dot{q}_{\text{exact}} \right\|^2 + \left\| \frac{\partial H_{\theta}}{\partial q} + \dot{p}_{\text{exact}} \right\|^2$$
- **Pérdida de Conservación de Momento Angular:**
  $$\mathcal{L}_{\text{angular}} = \|\vec{L}_{\text{pred}} - \vec{L}_0\|^2$$

---

## 🔮 4. Preservación del Volumen del Espacio de Fase (Teorema de Liouville)

Una transformación en el espacio de fase $\vec{z} = (q, p)$ es **simpléctica** si su matriz Jacobiana $J = \frac{\partial \vec{z}_{t+1}}{\partial \vec{z}_t}$ satisface la condición simpléctica:

$$J^T \Omega J = \Omega, \quad \text{donde } \Omega = \begin{pmatrix} 0 & I \\ -I & 0 \end{pmatrix}$$

Esto implica geométricamente que el determinante del Jacobiano es unitario:

$$\det(J) = 1$$

### ¿Por qué importa esto?
Si $\det(J) > 1$, la simulación gana energía artificialmente y las órbitas explotan. Si $\det(J) < 1$, la simulación pierde energía y las órbitas colapsan al centro. **Al garantizar $\det(J) = 1$, AstroDynamics 3D logra estabilidad orbital infinita.**

---

## 🛠️ Resumen para Desarrolladores

1. **`pinn_surrogate/models/hnn.py`:** Define la arquitectura de la red $H_{\theta}(q, p)$ con capas densas y activaciones suaves (SiLU / Softplus).
2. **`pinn_surrogate/tests/test_pinn_conservation.py`:** Suite de pruebas en Pytest que verifica que la deriva de la energía predicha sea menor a $10^{-6}$ tras $1,000+$ pasos.
