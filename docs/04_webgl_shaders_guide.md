# 🎨 Guía Educativa: Shaders 3D WebGL, Atmósferas & Post-Procesamiento HDR

Bienvenido a la guía visual y matemática de **AstroDynamics 3D**. En este documento se explican las bases físicas y las formulaciones analíticas de los shaders en tiempo real desarrollados con React 19, Three.js y WebGL 2.0 en [`web_ui/src/visuals/`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/visuals).

---

## 🌟 1. Shaders de Soles y Atmósferas Planetarias

En lugar de proyectar esferas poligonales con sombreado estático, **AstroDynamics 3D** implementa materiales GLSL basados en la física con iluminación per-pixel.

### A. Resplandor Atmosférico de Rayleigh (Inverted Fresnel Glow)

El efecto de dispersión atmosférica ([`AtmosphereShader.ts`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/visuals/AtmosphereShader.ts)) reproduce el halo brillante en el limbo de los planetas. Se renderiza sobre una esfera escalada un $18\%$ ($R_{\text{atm}} = 1.18 R_{\text{planeta}}$) utilizando las caras posteriores (`side: THREE.BackSide`) con mezcla aditiva (`THREE.AdditiveBlending`).

La transparencia y radiancia marginal dependen del ángulo entre la normal exterior de la superficie $\vec{n}$ y el rayo incidente de la cámara $\vec{v}$ (ambos vectores unitarios, $\|\vec{n}\| = \|\vec{v}\| = 1$):

$$
F_{\text{Fresnel}} = 1.0 - \max(\vec{n} \cdot \vec{v}, 0.0)
$$

$$
\alpha = I_0 \left( F_{\text{Fresnel}} \right)^p, \qquad \mathbf{C}_{\text{out}} = 1.5 \, \mathbf{C}_{\text{atmósfera}}
$$

Donde:
- $\vec{n} \cdot \vec{v} = \cos \theta$, siendo $\theta$ el ángulo entre la normal y la visual de la cámara.
- En el centro del disco planetario ($\theta = 0 \implies \vec{n} \cdot \vec{v} = 1$), el resplandor se anula ($\alpha = 0$).
- En el limbo rasante ($\theta \to \frac{\pi}{2} \implies \vec{n} \cdot \vec{v} \to 0$), la opacidad alcanza su máximo ($\alpha \to I_0$).
- $p = 3.5$ es el exponente de potencia de decaimiento marginal (`uPower`).
- $I_0 = 1.25$ es el factor de escala de intensidad (`uIntensity`).

### B. Granulación Fotosférica Solar con Ruido Simplex 3D

El shader del Sol ([`SunShader.ts`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/visuals/SunShader.ts)) reproduce la turbulencia del plasma y el oscurecimiento del limbo fotosférico (*limb brightening / corona*).

#### 1. Campo de Ruido Multifrecuencia
A partir de la posición espacial local del vértice $\vec{r} \in \mathbb{R}^3$ (`vPosition`) y el tiempo escalado $t' = 0.45 t$ (`uTime * 0.45`):

Las dos octavas de turbulencia generadas por la función analítica de ruido Simplex tridimensional $\text{snoise}: \mathbb{R}^3 \to [-1, 1]$ se evalúan con sus correspondientes frecuencias espaciales y vectores de advección temporal en $\mathbb{R}^3$:

$$
N_1(\vec{r}, t) = \text{snoise}\left( 3.5 \vec{r} + \begin{pmatrix} 0 \\ 0.8 t' \\ 0.4 t' \end{pmatrix} \right)
$$

$$
N_2(\vec{r}, t) = \text{snoise}\left( 8.0 \vec{r} - \begin{pmatrix} 0.5 t' \\ 0 \\ 0.7 t' \end{pmatrix} \right)
$$

El campo fotosférico resultante combina ambas octavas mediante una síntesis espectral ponderada con amplitudes $1/2$ y $1/4$, centrando el escalar en el rango normalizado $[0, 1]$:

$$
s(\vec{r}, t) = \frac{1}{2} \left[ N_1(\vec{r}, t) + \frac{1}{2} N_2(\vec{r}, t) \right] + \frac{1}{2} = \frac{1}{2} N_1(\vec{r}, t) + \frac{1}{4} N_2(\vec{r}, t) + \frac{1}{2}
$$

#### 2. Interpolación Dinámica de Plasma
La mezcla del plasma fotosférico interpola el color base $\mathbf{C}_{\text{base}}$ (`#fbbf24`), el núcleo incandescente $\mathbf{C}_{\text{core}}$ (`#ffffff`) y las llamaradas cromosféricas $\mathbf{C}_{\text{flare}}$ (`#ef4444`):

$$
\mathbf{C}_1(s) = \left(1 - s^{1.8}\right) \mathbf{C}_{\text{base}} + s^{1.8} \mathbf{C}_{\text{core}}
$$

$$
w_{\text{flare}}(s) = 0.65 (1.0 - s)
$$

$$
\mathbf{C}_{\text{plasma}}(s) = \left(1 - w_{\text{flare}}(s)\right) \mathbf{C}_1(s) + w_{\text{flare}}(s) \mathbf{C}_{\text{flare}}
$$

#### 3. Realce del Limbo Solar (Corona Fresnel) y Emisión Total
$$
F_{\text{rim}} = 1.0 - \max(\vec{n} \cdot \vec{v}, 0.0)
$$

$$
\mathbf{C}_{\text{rim}} = 1.8 \left(F_{\text{rim}}\right)^{2.2} \mathbf{C}_{\text{base}} + \left(F_{\text{rim}}\right)^{4.0} \mathbf{C}_{\text{core}}
$$

$$
\mathbf{C}_{\text{final}} = 1.4 \left( \mathbf{C}_{\text{plasma}}(s) + \mathbf{C}_{\text{rim}} \right)
$$

---

## ✨ 2. Campo Estelar Volumétrico & Clasificación Espectral de Harvard

El campo estelar ([`CosmicStarfield.ts`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/visuals/CosmicStarfield.ts)) genera 5,500+ partículas estelares distribuidas en una cáscara esférica tridimensional mediante muestreo esférico uniforme:

$$
r = 180 + 320 u_r, \qquad u_r \sim \mathcal{U}(0, 1) \implies r \in [180, 500]
$$

$$
\theta = 2\pi u_\theta, \qquad u_\theta \sim \mathcal{U}(0, 1)
$$

$$
\phi = \arccos(2u_\phi - 1), \qquad u_\phi \sim \mathcal{U}(0, 1) \implies \cos\phi \sim \mathcal{U}(-1, 1)
$$

$$
\vec{r}_{\text{star}} = \begin{pmatrix} r \sin\phi \cos\theta \\ r \sin\phi \sin\theta \\ r \cos\phi \end{pmatrix}
$$

### A. Shaders de Partícula Estelar (Vertex & Fragment)
En el *Vertex Shader*, el tamaño en pantalla se escala por la perspectiva de cámara y el parpadeo armónico individual:

$$
S_{\text{screen}} = S_0 \cdot \alpha_{\text{twinkle}}(t, \psi) \left( \frac{300}{-z_{\text{view}}} \right)
$$

$$
\alpha_{\text{twinkle}}(t, \psi) = 0.75 + 0.25 \sin(2.8 t + 4.0 \psi), \qquad \psi \sim \mathcal{U}(0, 2\pi)
$$

En el *Fragment Shader*, cada punto se modela como un disco gaussiano continuo sin pixelado:

$$
d = \left\| \vec{u}_{\text{coord}} - \begin{pmatrix} 0.5 \\ 0.5 \end{pmatrix} \right\|_2
$$

$$
I(d) = \begin{cases} \exp(-10 d^2), & \text{si } d \le 0.5 \\ 0, & \text{si } d > 0.5 \text{ (discard)} \end{cases}
$$

$$
\mathbf{C}_{\text{frag}} = 1.3 \, \mathbf{C}_{\text{espectral}} \cdot I(d) \cdot \alpha_{\text{twinkle}}
$$

### B. Secuencia de Harvard & Calibración de Color

| Clase | Temperatura ($T_{\text{eff}}$) | Color RGB Hex | Tipo Espectral | Muestreo Simulación ($P_{\text{sim}}$) | Abundancia Astrofísica ($\eta_{\text{astro}}$) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **O** | $35{,}000\text{ K}$ | `#9bb0ff` | Azul Profundo | $5.0\%$ ($p < 0.05$) | $\sim 0.00003\%$ |
| **B** | $20{,}000\text{ K}$ | `#bbccff` | Blanco Azulado | $10.0\%$ ($0.05 \le p < 0.15$) | $\sim 0.13\%$ |
| **A** | $9{,}000\text{ K}$ | `#f8f9ff` | Blanco Puro | $15.0\%$ ($0.15 \le p < 0.30$) | $\sim 0.60\%$ |
| **F** | $7{,}000\text{ K}$ | `#fff4ea` | Blanco Amarillento | $20.0\%$ ($0.30 \le p < 0.50$) | $\sim 3.00\%$ |
| **G** | $5{,}500\text{ K}$ | `#fff2a3` | Amarillo Solar | $20.0\%$ ($0.50 \le p < 0.70$) | $\sim 7.60\%$ |
| **K** | $4{,}000\text{ K}$ | `#ffd2a1` | Naranja Cálido | $18.0\%$ ($0.70 \le p < 0.88$) | $\sim 12.10\%$ |
| **M** | $3{,}000\text{ K}$ | `#ff8f70` | Enana Roja / Gigante | $12.0\%$ ($p \ge 0.88$) | $\sim 76.40\%$ |

> [!NOTE]
> La simulación sobre-representa las gigantes luminosas O, B y A ($30\%$ combinado en simulación vs $<1\%$ real) para asegurar riqueza cromática e inmersión visual en el espacio 3D.

---

## 💫 3. Pipeline HDR: Bloom Volumétrico & Mapeo de Tonos ACES

El pipeline de post-procesamiento en [`OrbitCanvas3D.tsx`](file:///mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/web_ui/src/components/OrbitCanvas3D.tsx) encadena `EffectComposer` con `UnrealBloomPass` y mapeo de tonos `ACESFilmicToneMapping`:

### 1. Extracción de Luminancia con Rodilla Suave (Soft-Knee Thresholding)
Dada la radiancia $\mathbf{C} = (R, G, B)$ en espacio HDR, se evalúa su luminancia estándar ITU-R BT.709:

$$
Y = 0.2126 R + 0.7152 G + 0.0722 B
$$

Para evitar artefactos de parpadeo discontinuo (*fireflies*), el umbral de Bloom ($Y_{\text{th}} = 0.18$) utiliza una rodilla de transición cuadrática con ancho $\kappa$:

$$
k(Y) = \frac{\max(Y - Y_{\text{th}}, 0)}{Y + 10^{-4}}
$$

$$
\mathbf{C}_{\text{bright}} = k(Y) \mathbf{C}
$$

### 2. Convolución Gaussiana 2D Separable
La imagen brillante se difumina en una pirámide de resolución mediante un kernel gaussiano separable:

$$
G(x, y) = \frac{1}{2\pi \sigma^2} \exp\left( -\frac{x^2 + y^2}{2\sigma^2} \right) = \left( \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{x^2}{2\sigma^2}} \right) \left( \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{y^2}{2\sigma^2}} \right)
$$

Al descomponer la convolución 2D en dos pasadas 1D contiguas (horizontal y vertical), el costo por píxel se reduce de $\mathcal{O}(K^2)$ a $\mathcal{O}(2K)$ accesos a textura.

### 3. Fusión Aditiva HDR
$$
\mathbf{C}_{\text{HDR}} = \mathbf{C}_{\text{escena}} + \beta \cdot \mathbf{C}_{\text{bloom}}
$$

Donde $\beta \in [0.5, 3.0]$ (`bloomIntensity`, por defecto $1.2$) controla la intensidad volumétrica de halo.

### 4. Mapeo de Tonos ACES Filmic (HDR $\to$ SDR)
Para comprimir la radiancia infinita $\mathbf{C}_{\text{HDR}} \in [0, \infty)$ en el rango de pantalla $[0, 1]$ sin desaturar los colores fotosféricos ni quemar el canal blanco, Three.js aplica la aproximación de Narkowicz de la curva ACES (*Academy Color Encoding System*) con exposición $E = 1.1$:

$$
\mathbf{x} = 1.1 \, \mathbf{C}_{\text{HDR}}
$$

$$
\mathbf{C}_{\text{SDR}} = \frac{\mathbf{x}(2.51 \mathbf{x} + 0.03)}{\mathbf{x}(2.43 \mathbf{x} + 0.59) + 0.14}
$$

Esta formulación produce sombras profundas con negros limpios, realza los tonos medios dorados del Sol y preserva los bordes brillantes de las estelas orbitales.
