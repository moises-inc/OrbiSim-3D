# 🎨 Guía Educativa: Shaders 3D WebGL, Atmósferas & Post-Procesamiento HDR

Bienvenido a la guía visual de **AstroDynamics 3D**. Este documento explica el funcionamiento interno del motor gráfico en tiempo real construido con React 19, Three.js y WebGL 2.0.

---

## 🌟 1. Shaders de Soles y Atmósferas Planetarias

En lugar de renderizar esferas monocromáticas simples, **AstroDynamics 3D** utiliza custom GLSL Vertex y Fragment Shaders.

### A. Resplandor Fresnel (Atmosphere Scattering)
El efecto Fresnel simula la dispersión de luz de Rayleigh alrededor de los bordes de la atmósfera de un planeta. La intensidad del resplandor marginal depende del producto escalar entre la normal de la superficie $\vec{N}$ y el vector de visión de la cámara $\vec{V}$:

$$I_{\text{Fresnel}} = \left( 1.0 - \vec{N} \cdot \vec{V} \right)^p$$

Donde $p$ controla la nitidez de la capa atmosférica.

---

## ✨ 2. Campo Estelar Volumétrico & Clasificación Espectral

El espacio estelar no es uniforme. **AstroDynamics 3D** genera 5,000+ estrellas basadas en la **Secuencia Principal de Morgan-Keenan (Clases O, B, A, F, G, K, M)**:

| Clase | Temperatura (K) | Color RGB | Proporción Real |
| :---: | :---: | :---: | :---: |
| **O** | $> 30,000$ | Azul Cobalto (`#60a5fa`) | ~0.00003% |
| **B** | $10,000 - 30,000$ | Blanco Azulado (`#93c5fd`) | ~0.13% |
| **A** | $7,500 - 10,000$ | Blanco Puro (`#f8fafc`) | ~0.6% |
| **G** | $5,200 - 6,000$ | Amarillo Solar (`#fde047`) | ~7.6% (ej. Sol) |
| **M** | $2,400 - 3,700$ | Enana Roja (`#f87171`) | ~76.4% |

---

## 💫 3. Post-Procesamiento Bloom Volumétrico (`UnrealBloomPass`)

El Bloom lumínico simula la difracción de la luz que ocurre en lentes de cámaras astronómicas reales cuando observan cuerpos extremadamente brillantes (como estrellas o núcleos estelares).

```
[Escena WebGL] ──> [Filter High Luminance] ──> [GaussianBlur Pipeline] ──> [Additive Blend]
```

El post-procesamiento se logra mediante el `EffectComposer` de Three.js con un passe de `UnrealBloomPass(strength=1.4, radius=0.6, threshold=0.15)` calibrado para mantener 60 FPS.
