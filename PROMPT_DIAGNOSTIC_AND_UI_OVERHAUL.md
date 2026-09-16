# 📋 PROMPT MASTER DE DIAGNÓSTICO FÍSICO Y REDISEÑO VISUAL WEBGL 3D: ORBISIM-3D

> **Destinatario:** Agy CLI / OpenCode / Subagentes Antigravity
> **Modelo Recomendado:** `nvidia/qwen/qwen3-coder-480b-a35b-instruct` (o `nvidia/deepseek-ai/deepseek-v4-pro` / `gemini-3.8-pro`)
> **Directorio de Ejecución Absoluto:** `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/`
> **Proyecto Macro:** Proyecto Tennessee (`PVT_kwHODxpfo84Bjd32`)
> **Habilidades Requeridas (Agent Skills):**
> - `debugging-and-error-recovery`: Diagnóstico metódico de causa raíz en la divergencia de la física.
> - `rigorous-verification-and-analysis`: Análisis numérico riguroso de integradores y conservación de invariantes.
> - `ui-ux-pro-max`: Dirección estética WebGL 3D, paleta cromática espacial y tipografía.
> - `taste-design`: Refinamiento de micro-interacciones, animaciones suaves y destellos glowing.
> - `frontend-ui-engineering`: Ingeniería de interfaces WebGL en React 19 + Three.js + Vite.
> - `impeccable-ui-audit`: Auditoría de detalles visuales, HUD y espaciados de UI.

---

## 🎯 Contexto y Causa Raíz a Diagnosticar

Durante simulaciones de mecánica celeste a largo plazo en **OrbiSim-3D**, se han detectado dos grandes limitaciones:

1. **Divergencia Física / Colapso de Órbitas:**
   - Las órbitas de los cuerpos celestes colapsan o salen eyectadas al infinito tras $10^3 - 10^5$ pasos de simulación.
   - **Causa Raíz Identificada:**
     a. Uso de paso de tiempo fijo ($\Delta t$) sin resolución adaptativa para encuentros cercanos (pericentros rápidos donde $r_{ij} \to 0$ y $F \propto 1/r^2$ produce aceleraciones ficticias gigantescas).
     b. Deriva baricéntrica no corregida: el centro de masa $(R_{cm}, V_{cm})$ acumula errores de redondeo flotante y desplaza el sistema entero fuera de la vista de la cámara.
     c. El sustituto PINN en `physics.ts` (`stepPINNSurrogate`) ejecuta un paso Symplectic Euler de 1er orden no simétrico con error $O(\Delta t)$, generando acumulación lineal/cuadrática de energía.
2. **Apariencia Visual Simplista ("Cuadros Blancos"):**
   - El renderizado 3D actual utiliza partículas básicas y esferas monocromáticas sin textura ni shader atmosférico.
   - Falta de shader de corona solar, atmósferas con dispersión de Rayleigh, campo estelar fotorrealista (por tipos espectrales O/B/A/F/G/K/M), estelas de luz degradadas con resplandor (bloom) y panel de control con estética premium glassmorphism.

---

## 🛠️ Plan Táctico de Implementación

### Módulo 1: Corrección Estabilidad Física & Adaptabilidad (Engine & Physics)

- [ ] **1.1. Adaptabilidad Dinámica de Paso de Tiempo ($\Delta t$ adaptativo):**
  - Implementar criterio de paso adaptativo basado en la distancia mínima entre cuerpos:
    $$\Delta t_{\text{adaptive}} = \min \left( \Delta t_{\text{max}}, \; \eta \cdot \min_{i \ne j} \sqrt{\frac{r_{ij}^3}{G (m_i + m_j)}} \right)$$
  - En `web_ui/src/physics.ts` y `cpp_core/src/nbody_solver.cpp`, implementar sub-stepping automático durante pericentros sin afectar los 60 FPS de la interfaz.
- [ ] **1.2. Corrección Invariante del Centro de Masa (Barycentric Drift Reset):**
  - En cada paso o intervalo de sincronización, restar la velocidad del centro de masa $\mathbf{V}_{\text{cm}}$ para mantener el momento lineal total $\mathbf{P} = \mathbf{0}$.
- [ ] **1.3. Sustituto PINN Simpléctico de 2º Orden:**
  - Actualizar `stepPINNSurrogate` en `physics.ts` a un esquema Störmer-Verlet / Leapfrog conservativo de volumen en el espacio de fase $(q,p)$, garantizando error $O(\Delta t^2)$ con energía acotada.

---

## 🎨 Módulo 2: Rediseño Estético WebGL 3D Fotorrealista (`ui-ux-pro-max` + `taste-design`)

- [ ] **2.1. Materiales & Shaders de Cuerpos Celestes:**
  - **Soles/Estrellas:** Shader de plasma dinámico animado con resplandor Fresnel (emissive glow) y destello (corona flare).
  - **Planetas:** Materiales fotorrealistas con texturas de superficie en alta resolución (procedural o mapa normal/rugosidad) y shader de atmósfera con dispersión de luz (atmosphere scattering halo).
- [ ] **2.2. Campo Estelar Cósmico (Deep Space Starfield & Nebulae):**
  - Reemplazar el grid estático por un campo estelar volumétrico de 5,000+ estrellas clasificadas por temperatura de color (clases espectrales O, B, A, F, G, K, M) con parpadeo animado (twinkle shader).
  - Agregar fondo de polvo cósmico / nubes de nebulosas profundas con degradados suaves en tonos cian, violeta y cobalto.
- [ ] **2.3. Estelas Orbitales Resplandecientes (Glowing Motion Trails):**
  - Reemplazar líneas simples de 1px por cintas/degradados de partículas resplandecientes que se atenúan suavemente (alpha fade) desde la cabeza del cuerpo hasta la cola.
- [ ] **2.4. Post-Procesamiento Volumétrico Bloom:**
  - Incorporar `EffectComposer`, `RenderPass` y `UnrealBloomPass` de Three.js para dar un efecto cinemático de resplandor lumínico a las estrellas y trayectorias sin degradar el rendimiento.
- [ ] **2.5. Panel de Control Glassmorphism & HUD Interactivo:**
  - Diseñar el HUD con estética espacial oscura (`slate-950/90`), efectos glassmorphism con `backdrop-blur-xl`, tipografía moderna (`JetBrains Mono` / `Inter`), gráficos SVG en tiempo real de deriva de energía $\Delta H/H_0$ y selectores de presets visuales.

---

## 🔬 Suite de Verificación & Cero Defectos

1. **Pruebas de Física (CTest / PyTest):**
   - Ejecutar `ctest` en `cpp_core/build` para comprobar 8/8 tests.
   - Ejecutar `pytest` en `pinn_surrogate/` para verificar la conservación de $H(q,p)$ a $10^6$ pasos.
2. **Compilación Frontend:**
   - Ejecutar `npm run build` en `web_ui/` verificando 0 errores de TypeScript y bundler.
3. **Auditoría E2E con Playwright CLI:**
   - Ejecutar `playwright-cli open "http://localhost:5173"` y tomar capturas visuales en `/tmp/orbisim_pro_qa.png` para confirmar la calidad visual fotorrealista.

---

## 📌 Formato de Entrega
Actualizar el código fuente, ejecutar las suites de prueba, realizar commit git atómico y reportar los hallazgos en la bitácora `System_Logs/audit_diagnostics_2026_09_16.md`.
