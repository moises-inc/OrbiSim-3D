# 🎨 Guía Educativa: Shaders 3D WebGL, Atmósferas & Post-Procesamiento HDR

Bienvenido a la guía visual y matemática de **AstroDynamics 3D**. En este documento se explican las bases físicas y las formulaciones analíticas de los shaders en tiempo real desarrollados con React 19, Three.js y WebGL 2.0.

---

## 🌟 1. Shaders de Soles y Atmósferas Planetarias

En lugar de proyectar esferas poligonales estáticas, **AstroDynamics 3D** utiliza materiales programables en GLSL (*Vertex* y *Fragment Shaders*) con iluminación basada en la física.

### A. Resplandor Atmosférico de Rayleigh (Inverted Fresnel Glow)

El efecto de dispersión de Rayleigh simula el halo brillante alrededor de las atmósferas planetarias. La radiancia marginal depende del ángulo de incidencia entre el vector normal a la superficie $\vec{n}$ y la dirección de la visual de la cámara $\vec{v}$ (ambos unitarios, $\|\vec{n}\| = \|\vec{v}\| = 1$):

$$
I_{\text{Fresnel}} = I_0 \left( 1.0 - \max(\vec{n} \cdot \vec{v}, 0.0) \right)^p
$$

Donde:
- $\vec{n} \cdot \vec{v} = \cos \theta$, siendo $\theta$ el ángulo entre la normal de la superficie y el rayo de la cámara.
- Cuando la cámara mira perpendicularmente a la superficie ($\theta = 0 \implies \vec{n} \cdot \vec{v} = 1$), el resplandor se anula ($I_{\text{Fresnel}} = 0$).
- En el borde del horizonte visual ($\theta \to \frac{\pi}{2} \implies \vec{n} \cdot \vec{v} \to 0$), el resplandor alcanza su valor máximo ($I_{\text{Fresnel}} \to I_0$).
- $p$ es el exponente de potencia de decaimiento (`uPower`, típicamente $p \in [2.5, 4.0]$).
- $I_0$ es el factor de escala de intensidad (`uIntensity`).

### B. Granulación Fotosférica Solar con Ruido Simplex 3D

Para recrear el plasma dinámico del Sol (`SunShader.ts`), se modula la radiancia fotosférica mediante ruido procedural continuo tridimensional $s(\vec{r}, t) \in [0, 1]$:

$$
C_{\text{plasma}}(\vec{r}, t) = \operatorname{mix}\left(C_{\text{base}}, C_{\text{core}}, s(\vec{r}, t)^{1.8}\right) + C_{\text{flare}} \left(1.0 - s(\vec{r}, t)\right) \cdot 0.65
$$

---

## ✨ 2. Campo Estelar Volumétrico & Clasificación Espectral de Harvard

El campo estelar de **AstroDynamics 3D** (`CosmicStarfield.ts`) genera 5,500+ estrellas distribuidas en una cáscara esférica tridimensional de radio $r \in [180, 500]$ con temperaturas efectivas calibradas según la **Secuencia de Harvard (Morgan-Keenan)**:

$$
\vec{r}_{\text{star}} = \begin{pmatrix} r \sin\phi \cos\theta \\ r \sin\phi \sin\theta \\ r \cos\phi \end{pmatrix}, \qquad \theta \in [0, 2\pi), \quad \phi = \arccos(2u - 1), \quad u \in [0, 1]
$$

| Clase | Temperatura Efectiva ($T_{\text{eff}}$) | Color RGB Hex | Tipo Espectral | Proporción Cósmica |
| :---: | :---: | :---: | :---: | :---: |
| **O** | $T > 30{,}000\text{ K}$ | `#9bb0ff` | Azul Profundo | $\sim 0.00003\%$ |
| **B** | $10{,}000\text{ K} \le T \le 30{,}000\text{ K}$ | `#bbccff` | Blanco Azulado | $\sim 0.13\%$ |
| **A** | $7{,}500\text{ K} \le T < 10{,}000\text{ K}$ | `#f8f9ff` | Blanco Puro | $\sim 0.60\%$ |
| **F** | $6{,}000\text{ K} \le T < 7{,}500\text{ K}$ | `#fff4ea` | Blanco Amarillento | $\sim 3.00\%$ |
| **G** | $5{,}200\text{ K} \le T < 6{,}000\text{ K}$ | `#fff2a3` | Amarillo Solar (ej. Sol) | $\sim 7.60\%$ |
| **K** | $3{,}700\text{ K} \le T < 5{,}200\text{ K}$ | `#ffd2a1` | Naranja Cálido | $\sim 12.10\%$ |
| **M** | $2{,}400\text{ K} \le T < 3{,}700\text{ K}$ | `#ff8f70` | Enana Roja / Gigante | $\sim 76.40\%$ |

---

## 💫 3. Post-Procesamiento HDR Bloom Volumétrico (`UnrealBloomPass`)

El efecto de resplandor *Bloom* simula la dispersión de fotones en la óptica de telescopios astronómicos cuando capturan cuerpos celestes hiper-luminosos.

El proceso matemático se formula en tres etapas secuenciales:

### 1. Extracción de Luminancia por Umbral (Thresholding)

Dada la radiancia $C = (R, G, B)$ de cada píxel, se evalúa su luminancia perceptual estándar ITU-R BT.709:

$$
Y = 0.2126\,R + 0.7152\,G + 0.0722\,B
$$

$$
C_{\text{bright}} = \begin{cases} C, & \text{si } Y > Y_{\text{threshold}} \\ \mathbf{0}, & \text{en caso contrario} \end{cases}
$$

### 2. Convolución Gaussiana 2D Separable

La imagen brillante aislada se difumina mediante un kernel gaussiano bidimensional simétrico:

$$
G(x, y) = \frac{1}{2\pi \sigma^2} \exp\left( -\frac{x^2 + y^2}{2\sigma^2} \right) = \left( \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{x^2}{2\sigma^2}} \right) \left( \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{y^2}{2\sigma^2}} \right)
$$

Al ser un filtro matemáticamente separable, la convolución se ejecuta en dos pasadas unidimensionales ($\mathcal{O}(2K)$ en lugar de $\mathcal{O}(K^2)$ operaciones por píxel), preservando los 60 FPS estables.

### 3. Fusión Aditiva Final

$$
C_{\text{final}} = C_{\text{escena}} + \beta \cdot C_{\text{bloom}}
$$

Donde $\beta$ (`bloomIntensity`) es el escalar interactivo de control de brillo del panel de control.
