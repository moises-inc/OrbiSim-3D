# 🪐 Guía Educativa: Mecánica Celeste & Integradores Gravitacionales N-Cuerpos

Bienvenido a la guía conceptual y matemática de **AstroDynamics 3D**. Este documento está diseñado para que cualquier estudiante, investigador o desarrollador pueda comprender los principios físicos detras de las simulaciones gravitacionales de $N$-cuerpos y los algoritmos numéricos que las impulsan.

---

## 📐 1. Ley de Gravitación Universal de Newton

En un sistema gravitacional de $N$ cuerpos celestes (estrellas, planetas, asteroides), la fuerza ejercida sobre la masa $i$ ubicada en la posición $\vec{r}_i$ por la masa $j$ ubicada en $\vec{r}_j$ está dada por:

$$\vec{F}_{ij} = -G \frac{m_i m_j}{\|\vec{r}_i - \vec{r}_j\|^3} (\vec{r}_i - \vec{r}_j)$$

Donde:
- $G$ es la Constante Gravitacional Universal ($G \approx 6.67430 \times 10^{-11} \text{ m}^3 \text{kg}^{-1} \text{s}^{-2}$, u homologada a unidades naturales $G=1.0$).
- $m_i, m_j$ son las masas de los cuerpos $i$ y $j$.
- $\|\vec{r}_i - \vec{r}_j\|$ es la distancia euclidiana entre ambos cuerpos en el espacio 3D.

Por la Segunda Ley de Newton ($\vec{F}_i = m_i \vec{a}_i$), la aceleración de la partícula $i$ debido a todas las demás partículas $j \ne i$ es:

$$\vec{a}_i = \frac{d^2 \vec{r}_i}{dt^2} = G \sum_{j \ne i}^N \frac{m_j (\vec{r}_j - \vec{r}_i)}{(\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2)^{3/2}}$$

### 🛡️ El Parámetro de Suavizado ($\epsilon$ / Softening)
Cuando dos cuerpos se acercan mucho ($\vec{r}_i \to \vec{r}_j$), el término $\|\vec{r}_j - \vec{r}_i\| \to 0$, causando una **singularidad matemática** (división por cero) que dispara la aceleración al infinito. Para evitar esto en simulaciones numéricas, se añade un parámetro de suavizado $\epsilon > 0$ (softening):

$$r_{ij, \text{softened}} = \sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}$$

---

## ⚡ 2. Integradores Numéricos: RK4 vs. Verlet Simpléctico

Para mover el sistema en el tiempo a pasos discretos $\Delta t$, AstroDynamics 3D implementa dos esquemas fundamentales:

### A. Integrador Runge-Kutta de 4º Orden (RK4)
RK4 calcula cuatro pendientes intermedias ($k_1, k_2, k_3, k_4$) dentro del intervalo $[t, t + \Delta t]$:

$$\begin{aligned}
k_1 &= f(t, y_t) \\
k_2 &= f\left(t + \frac{\Delta t}{2}, y_t + \frac{\Delta t}{2} k_1\right) \\
k_3 &= f\left(t + \frac{\Delta t}{2}, y_t + \frac{\Delta t}{2} k_2\right) \\
k_4 &= f(t + \Delta t, y_t + \Delta t \, k_3) \\
y_{t+\Delta t} &= y_t + \frac{\Delta t}{6}(k_1 + 2k_2 + 2k_3 + k_4)
\end{aligned}$$

- **Ventaja:** Muy alta precisión local (error por paso $O(\Delta t^5)$).
- **Desventaja:** No preserva el espacio de fase (no es simpléctico), acumulando deriva de energía a largo plazo.

### B. Integrador de Verlet Simpléctico (Störmer-Verlet)
El integrador de Verlet es un algoritmo conservativo que respeta la geometría del espacio de fase (Teorema de Liouville). Su esquema de actualización es:

$$\begin{aligned}
\vec{r}(t + \Delta t) &= \vec{r}(t) + \vec{v}(t) \Delta t + \frac{1}{2} \vec{a}(t) \Delta t^2 \\
\vec{a}(t + \Delta t) &= \text{compute\_accelerations}(\vec{r}(t + \Delta t)) \\
\vec{v}(t + \Delta t) &= \vec{v}(t) + \frac{1}{2} [\vec{a}(t) + \vec{a}(t + \Delta t)] \Delta t
\end{aligned}$$

- **Ventaja:** **Cero deriva armónica de energía** a $10^6+$ pasos. Las órbitas permanecen acotadas y estables perpetuamente.
- **Eficiencia:** Requiere solo 1 evaluación de fuerza por paso reusando $\vec{a}(t)$.

---

## 📊 3. Leyes de Conservación e Invariantes Físicos

En un sistema gravitacional aislado se deben mantener constantes las siguientes magnitudes físicas:

1. **Energía Total del Hamiltoniano ($H$):**
   $$H(q,p) = T(p) + V(q) = \sum_{i=1}^N \frac{1}{2} m_i \|\vec{v}_i\|^2 - \sum_{i < j}^N \frac{G m_i m_j}{\|\vec{r}_j - \vec{r}_i\|}$$
   *Deriva Relativa:* $\frac{|H(t) - H(0)|}{|H(0)|} < 10^{-6}$

2. **Momento Angular Total ($\vec{L}$):**
   $$\vec{L} = \sum_{i=1}^N m_i (\vec{r}_i \times \vec{v}_i) = \text{Constante}$$

3. **Momento Lineal y Centro de Masa ($\vec{P}_{\text{tot}}, \vec{R}_{\text{cm}}$):**
   $$\vec{P}_{\text{tot}} = \sum_{i=1}^N m_i \vec{v}_i = \mathbf{0}, \quad \vec{R}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{r}_i$$

---

## 💡 Glosario Rápido para Principiantes

- **N-Cuerpos (N-Body):** Problema de simular la trayectoria de $N$ objetos interactuando gravitacionalmente entre sí.
- **Espacio de Fase:** Espacio abstracto de 6 dimensions por partícula compueso por sus coordenadas de posición $(x,y,z)$ y momento $(p_x, p_y, p_z)$.
- **Integrador Simpléctico:** Algoritmo numérico especial para ecuaciones hamiltonianas que preserva el área/volumen en el espacio de fase.
