# 🚀 PROMPT MASTER: RENOMBRADO A "ASTRODYNAMICS 3D" & SUITE MULTI-SUBAGENTE DE PRUEBAS INTENSIVAS

> **Destinatario:** Agy CLI / OpenCode / Orquestador Antigravity
> **Modelo Recomendado:** `nvidia/qwen/qwen3-coder-480b-a35b-instruct` (o `nvidia/deepseek-ai/deepseek-v4-pro` / `gemini-3.8-pro`)
> **Nuevo Nombre del Proyecto:** **AstroDynamics 3D**
> **Nuevo Slug de GitHub:** `moises-inc/astrodynamics-3d` (https://github.com/moises-inc/astrodynamics-3d)
> **Ruta Absoluta del Espacio de Trabajo:** `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D/` (a actualizar localmente si aplica)
> **Bóveda Obsidian de Memoria:** `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/ObsidianVault/`
> **Tablero Macro:** Proyecto Tennessee (`PVT_kwHODxpfo84Bjd32`), Tarjeta `#1`

---

## 📌 1. Misión Principal

Debes coordinar e invocar **subagentes especializados** para ejecutar una refactorización integral en dos fases clave:

1. **Renombrado Completo de Marca y Repositorio (`OrbiSim-3D` ➔ `AstroDynamics 3D`).**
2. **Despliegue de Subagentes "Testers" para Pruebas Intensivas Explratorias de Movimiento y UI.**

---

## 🛠️ FASE 1: Renombrado Integral del Repositorio & Código Fuente

### 1.1. Renombrado Remoto con GitHub CLI (`gh`)
- Ejecutar el renombrado del repositorio oficial mediante GitHub CLI:
  ```bash
  env -u GITHUB_TOKEN gh repo rename astrodynamics-3d --yes
  ```
- Actualizar la URL del remoto `origin` en Git local:
  ```bash
  git remote set-url origin https://github.com/moises-inc/astrodynamics-3d.git
  ```

### 1.2. Refactorización en Cascada en el Código Fuente
Sustituir de forma consistente cualquier referencia a `OrbiSim-3D`, `OrbiSim`, `orbisim` o `orbisim_3d` por `AstroDynamics 3D`, `AstroDynamics`, `astrodynamics` o `astrodynamics_3d` en los siguientes componentes:

1. **Motor C++20 (`cpp_core/`):**
   - Actualizar `CMakeLists.txt` (Nombre del proyecto: `AstroDynamics3DCore`).
   - Cambiar namespace en C++ de `namespace orbisim` a `namespace astrodynamics` en `nbody_solver.hpp` y `nbody_solver.cpp`.
   - Actualizar nombres de ejecutables de prueba en GoogleTest.
2. **Capa PINN (`pinn_surrogate/`):**
   - Actualizar `pyproject.toml`, `setup.py` o módulo Python a `astrodynamics_surrogate`.
   - Renombrar importaciones de tests en `pytest`.
3. **Frontend WebGL 3D (`web_ui/`):**
   - Actualizar `package.json` (`"name": "astrodynamics-3d-web"`).
   - Actualizar el título de la página HTML en `index.html` (`<title>AstroDynamics 3D — High-Performance N-Body Engine & Symplectic PINNs</title>`).
   - Actualizar encabezados del HUD overlay en `OrbitCanvas3D.tsx` y `ControlsPanel.tsx`.
4. **Documentación & Reglas (`AGENTS.md`, `README.md`, `README.es.md`, `SYSTEM_PROMPT`):**
   - Reemplazar todas las menciones a OrbiSim-3D por **AstroDynamics 3D**.
   - Actualizar citas BibTeX `@software{amundarain2026astrodynamics3d, ...}`.

---

## 🤖 FASE 2: Suite Multi-Subagente de Pruebas Intensivas (Exploración & Runtime QA)

Debes invocar y coordinar la **Trilogía de Subagentes** con instrucciones explícitas para que "jueguen", combinen configuraciones límite y detecten cualquier anomalía en el movimiento de los cuerpos celestes:

### Subagente 1: `scientific_runtime_accuracy_auditor`
- **Misión de Prueba Intensiva:**
  - Probar combinaciones extremas de parámetros físicos: masas asimétricas ($m_1=10^6, m_2=10^{-6}$), velocidades iniciales relativas hiperbólicas ($\|\vec{v}_0\| \gg v_{\text{escape}}$) y configuraciones binarias estrechas.
  - Alternar entre los 3 integradores en tiempo de ejecución (**Verlet**, **RK4**, **PINN Surrogate**) midiendo la conservación de energía total $H$, momento angular total $\vec{L}$ y momento lineal $\vec{P}$.
  - Identificar si se presentan "saltos de posición", aceleraciones no físicas o desviaciones de trayectoria.

### Subagente 2: `e2e_browser_visual_qa_tester` (con `playwright-cli`)
- **Misión de Prueba Intensiva:**
  - Iniciar el servidor dev y conectar via `playwright-cli open "http://localhost:5173"`.
  - Simular interacciones humanas agresivas:
    1. Clics consecutivos en los botones de cambio de presets (Kepler ➔ Figure-8 ➔ Lagrange L4).
    2. Modificación dinámica de los sliders de aceleración temporal (`speedMultiplier`), constantes de masa $m$, velocidad $\vec{v}_0$ y suavizado ($G$, `softening`).
    3. Alternar pausar/reanudar durante momentos de máxima aproximación de cuerpos celestes.
  - Tomar capturas visuales en `/tmp/astrodynamics_qa_play.png`, `/tmp/astrodynamics_stress.png` y certificar que la consola de JavaScript registre **0 excepciones o advertencias WebGL**.

### Subagente 3: `code_hpc_performance_auditor`
- **Misión de Prueba Intensiva:**
  - Auditar el rendimiento bajo condiciones de estrés ($N=128$, $N=512$, $N=1024$ partículas).
  - Medir latencias ms/paso en C++ (OpenMP/SIMD) vs JavaScript/Three.js.
  - Verificar que la liberación de memoria en GPU (`disposeHierarchy`) impida cualquier fuga tras 500+ ciclos de recreación de escenas.

---

## 📋 Criterios de Aceptación (Cero Defectos)

- [ ] Repositorio GitHub renombrado exitosamente a `moises-inc/astrodynamics-3d`.
- [ ] 0 referencias desactualizadas a "OrbiSim" en código, tests y documentación.
- [ ] Suites de prueba automatizadas superadas al 100%:
  - C++ GoogleTest: 8/8 tests PASSED (`ctest`).
  - Pytest PINN: 4/4 tests PASSED (`pytest`).
  - Web UI Build: `npm run build` con 0 errores TypeScript.
- [ ] Bitácora de auditoría registrada en `System_Logs/audit_diagnostics_2026_09_16.md` confirmando la estabilidad del movimiento de cuerpos celestes tras las pruebas del subagente.
- [ ] Tarjeta `#1` del Proyecto Tennessee actualizada mediante `gh project item-edit`.
