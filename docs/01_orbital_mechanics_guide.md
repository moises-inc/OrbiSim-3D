# 🪐 Guía Educativa: Mecánica Celeste & Integradores Gravitacionales N-Cuerpos

Bienvenido a la guía conceptual y matemática de **AstroDynamics 3D**. Este documento está diseñado para que cualquier estudiante, investigador o desarrollador comprenda con rigor físico y matemático los principios fundamentales de las simulaciones gravitacionales de $N$-cuerpos y los algoritmos numéricos que las gobiernan.

---

## 📐 1. Ley de Gravitación Universal de Newton

En un sistema gravitacional aislado de $N$ cuerpos celestes (estrellas, planetas, satélites), la fuerza de atracción gravitacional $\vec{F}_{ij}$ ejercida sobre la masa $m_i$ (ubicada en $\vec{r}_i$) por la masa $m_j$ (ubicada en $\vec{r}_j$) está dada por:

$$
\vec{F}_{ij} = G \frac{m_i m_j}{\|\vec{r}_j - \vec{r}_i\|^3} (\vec{r}_j - \vec{r}_i) = -G \frac{m_i m_j}{\|\vec{r}_i - \vec{r}_j\|^3} (\vec{r}_i - \vec{r}_j)
$$

Donde:
- $G$ es la Constante de Gravitación Universal ($G \approx 6.67430 \times 10^{-11}\text{ m}^3\text{kg}^{-1}\text{s}^{-2}$, u homologada a unidades astronómicas/naturales $G = 1.0$).
- $m_i, m_j$ son las masas gravitatorias de los cuerpos $i$ y $j$.
- $\vec{r}_j - \vec{r}_i$ es el vector desplazamiento dirigido desde la masa $i$ hacia la masa $j$.
- $\|\vec{r}_j - \vec{r}_i\|$ es la distancia euclidiana en el espacio tridimensional $\mathbb{R}^3$.

Por la Segunda Ley de Newton ($\vec{F}_i = m_i \vec{a}_i$), la aceleración neta de la partícula $i$ debida a la atracción combinada de todas las demás masas $j \neq i$ es:

$$
\vec{a}_i = \frac{d^2 \vec{r}_i}{dt^2} = G \sum_{\substack{j=1 \\ j \ne i}}^N \frac{m_j (\vec{r}_j - \vec{r}_i)}{\left(\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2\right)^{3/2}}
$$

### 🛡️ Parámetro de Suavizado de Plummer ($\epsilon$ / Softening)

Cuando dos partículas experimentan un encuentro cercano ($\vec{r}_i \to \vec{r}_j$), la distancia mutua $\|\vec{r}_j - \vec{r}_i\| \to 0$, originando una **singularidad no física** que produce aceleraciones y velocidades divergentes al infinito. 

Para regularizar numéricamente el denominador, se introduce el parámetro de suavizado esférico de Plummer $\epsilon > 0$:

$$
r_{ij, \epsilon} = \sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}
$$

El potencial gravitacional regularizado de Plummer queda definido como:

$$
\Phi_\epsilon(r) = -\frac{G M}{\sqrt{r^2 + \epsilon^2}}
$$

---

## ⚡ 2. Integradores Numéricos: RK4 Clásico vs. Störmer-Verlet Simpléctico

Para propagar el sistema dinámico en el tiempo con paso discreto $\Delta t$, **AstroDynamics 3D** proporciona esquemas de integración complementarios:

### A. Integrador Clásico Runge-Kutta de 4º Orden (RK4)

RK4 muestrea cuatro pendientes vectoriales intermedias ($k_1, k_2, k_3, k_4$) dentro del intervalo $[t, t + \Delta t]$:

$$
\begin{aligned}
k_1 &= f(t, y_t) \\
k_2 &= f\left(t + \frac{\Delta t}{2}, y_t + \frac{\Delta t}{2} k_1\right) \\
k_3 &= f\left(t + \frac{\Delta t}{2}, y_t + \frac{\Delta t}{2} k_2\right) \\
k_4 &= f(t + \Delta t, y_t + \Delta t \, k_3) \\
y_{t+\Delta t} &= y_t + \frac{\Delta t}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)
\end{aligned}
$$

- **Error de Truncamiento Local:** $\mathcal{O}(\Delta t^5)$ por paso (error global $$\mathcal{O}(\Delta t^4)$$).
- **Limitación en Dinámica Orbital:** RK4 **no es simpléctico**. No conserva el volumen de fase ni la 2-forma simpléctica $\omega = dq \wedge dp$, lo que genera una deriva secular de energía a largo plazo (las órbitas decaen o se expanden artificialmente).

### B. Integrador Velocity Verlet Simpléctico (Störmer-Verlet)

El integrador de Verlet es un método geométrico de Strang-splitting que respeta la estructura hamiltoniana del espacio de fases (Teorema de Liouville). Su algoritmo de actualización en dos semipasos es:

$$
\begin{aligned}
\vec{r}(t + \Delta t) &= \vec{r}(t) + \vec{v}(t)\,\Delta t + \frac{1}{2}\,\vec{a}(t)\,\Delta t^2 \\
\vec{a}(t + \Delta t) &= \vec{a}\big(\vec{r}(t + \Delta t)\big) \\
\vec{v}(t + \Delta t) &= \vec{v}(t) + \frac{1}{2}\left[\vec{a}(t) + \vec{a}(t + \Delta t)\right]\Delta t
\end{aligned}
$$

- **Propiedad Clave:** **Cero deriva secular de energía**. Conserva un Hamiltoniano sombra $\tilde{H} = H + \mathcal{O}(\Delta t^2)$, manteniendo las fluctuaciones energéticas estrictamente acotadas sobre millones de pasos.
- **Eficiencia HPC:** Al reutilizar la aceleración $\vec{a}(t + \Delta t)$ en el ciclo temporal subsecuente (`cur_acc_`), solo requiere **1 sola evaluación de fuerza $\mathcal{O}(N^2)$ por paso**.

---

## 📊 3. Leyes de Conservación e Invariantes Físicos

En un sistema gravitacional aislado en $\mathbb{R}^3$, la física teórica exige la conservación exacta de las siguientes cantidades:

### 1. Energía Total del Hamiltoniano ($H$)

$$
H(q, p) = T(p) + V(q) = \sum_{i=1}^N \frac{1}{2} m_i \|\vec{v}_i\|^2 - \sum_{1 \le i < j \le N} \frac{G m_i m_j}{\sqrt{\|\vec{r}_j - \vec{r}_i\|^2 + \epsilon^2}}
$$

El error relativo de energía del sistema se monitoriza en tiempo real:

$$
\frac{|H(t) - H(0)|}{|H(0)|} < 10^{-6}
$$

### 2. Momento Angular Total ($\vec{L}$)

Debido a la isotropía del espacio (invariancia bajo rotaciones $SO(3)$ por el Teorema de Noether):

$$
\vec{L} = \sum_{i=1}^N m_i (\vec{r}_i \times \vec{v}_i) = \text{constante}
$$

### 3. Momento Lineal Total y Centro de Masas ($$\vec{P}_{\text{tot}}, \vec{R}_{\text{cm}}$$)

Por la homogeneidad del espacio (invariancia bajo traslaciones espaciales):

$$
\vec{P}_{\text{tot}} = \sum_{i=1}^N m_i \vec{v}_i = \mathbf{0}, \qquad \vec{R}_{\text{cm}} = \frac{1}{M_{\text{tot}}} \sum_{i=1}^N m_i \vec{r}_i
$$

Donde $M_{\text{tot}} = \sum_{i=1}^N m_i$ es la masa total del sistema.

---

## 💡 Glosario Rápido para Principiantes

- **Problema de N-Cuerpos:** Determinación analítica o numérica de las trayectorias de $N$ masas puntuales que interactúan gravitacionalmente según las leyes de Newton.
- **Espacio de Fases:** Espacio geométrico de $6N$ dimensiones compuesto por las posiciones generalizadas $q = (\vec{r}_1, \dots, \vec{r}_N)$ y momentos conjugados $p = (\vec{p}_1, \dots, \vec{p}_N)$.
- **Integrador Simpléctico:** Algoritmo numérico que preserva exactamente la 2-forma simpléctica cerrada no degenerada $\omega = \sum dq_i \wedge dp_i$, garantizando estabilidad orbital permanente.
