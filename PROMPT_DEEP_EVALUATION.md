# 🪐 PROMPT DE EVALUACIÓN PROFUNDA, AUDITORÍA Y MEJORA AUTÓNOMA — OrbiSim-3D

> **Destinatario:** `agy` (Agent CLI / Antigravity / OpenCode)  
> **Proyecto:** OrbiSim-3D (`moises-inc/OrbiSim-3D`) | **Proyecto Tennessee** (`PVT_kwHODxpfo84Bjd32`)  
> **Ruta Absoluta del Espacio de Trabajo:** `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D`  
> **Modelos Sugeridos:** `nvidia/qwen/qwen3-coder-480b-a35b-instruct` / Gemini 3.8 / Gemini 3.6 Pro

---

## 🎯 MISIÓN PRINCIPAL

Ejecutar una **auditoría 360° profunda y refactorización integral** de la aplicación **OrbiSim-3D** evaluando desde la exactitud física y matemática hasta la calidad del código C++20, JAX y el renderizado WebGL 3D en React 19.

Debes coordinar la auditoría invocando **subagentes especializados**, ejecutar pruebas numéricas en runtime, corregir cualquier inconsistencia detectada, subir los cambios al repositorio remoto en GitHub (`moises-inc/OrbiSim-3D`) y actualizar el estado de las tarjetas en el tablero de **Proyecto Tennessee** usando la **GitHub CLI (`gh`)**.

---

## 🧭 FASES DE EJECUCIÓN OBLIGATORIAS

### FASE 1: Auditoría Multi-Eje por Subagentes Especializados

Debes delegar las siguientes tareas de inspección en tiempo de ejecución a los subagentes registrados en `AGENTS.md`:

1. 🔬 **Invocación a `scientific_runtime_accuracy_auditor`:**
   - Auditar la conservación del Hamiltoniano $H(q,p) = T(p) + V(q)$ y del vector momento angular $\vec{L} = \vec{r} \times \vec{p}$ en los integradores de `cpp_core` y el modelo PINN simpléctico de `pinn_surrogate`.
   - Verificar la exactitud de constantes astronómicas ($G$, masas solares/terrestres), unidades SI/IUPAC y leyes de Kepler en `model.py` y `demo_inference.py`.

2. 🌐 **Invocación a `e2e_browser_visual_qa_tester` (Pruebas de Navegador Real con Playwright CLI):**
   - Levantar el servidor dev o build de `web_ui` (`npm run dev` o `vite preview`).
   - Ejecutar `playwright-cli open "http://localhost:5173"` desde la consola.
   - Probar la interacción humana: simular clics en botones de simulación (`playwright-cli click`), cambiar masa/velocidad (`playwright-cli fill`) y tomar capturas visuales en `/tmp/orbisim_qa.png` con `playwright-cli screenshot`.
   - Capturar e inspeccionar la consola de JavaScript en busca de errores WebGL, fugas de contextos Three.js o excepciones No-Catch.

3. ⚡ **Invocación a `code_hpc_performance_auditor`:**
   - Medir latencia por paso de simulación ($ms/\text{step}$) en C++20 y Python/JAX.
   - Auditar la compilación `CMakeLists.txt` con flags `-O3 -fopenmp -march=native`.
   - Detectar fugas de memoria en C++ o uso excesivo de VRAM en JAX/PyTorch.

---

### FASE 2: Diagnóstico, Refactorización & Corrección de Código

Con base en los informes de los subagentes, debes corregir e implementar mejoras en cada módulo:

#### A. Módulo C++20 (`cpp_core/`)
- Verificar compilación limpia de `CMakeLists.txt` y ejecución de binarios de prueba.
- Garantizar que los integradores (Runge-Kutta 4º orden y Verlet Simpléctico) respeten la conservación de energía.
- Ejecutar la suite de pruebas unitarias (`GoogleTest` / `Catch2` en `cpp_core/tests/`).

#### B. Módulo PINN Simpléctico (`pinn_surrogate/`)
- Auditar la loss simpléctica $\mathcal{L}_{\text{symplectic}} = \|\nabla_p H - \dot{q}\|^2 + \|\nabla_q H + \dot{p}\|^2$.
- Asegurar que la inferencia en `model.py` y `demo_inference.py` no sufra de deriva armónica.
- Ejecutar `pytest pinn_surrogate/tests/` certificando la suite de pruebas.

#### C. Módulo Frontend 3D (`web_ui/`)
- Verificar que React 19 + Three.js (`@react-three/fiber`) liberen recursos WebGL recursivamente al desmontar componentes (`disposeHierarchy`).
- Optimizar renderizado a 60 FPS evitando re-renders innecesarios en el bucle de animación de React.
- Validar `npm run build` sin errores de TypeScript (`0 errors`).

---

### FASE 3: Persistencia Git & Automatización en Proyecto Tennessee (GitHub CLI)

Al finalizar las correcciones y pruebas:

1. **Compilar y Verificar 100% PASS:**
   - C++: Compilación limpia en `cpp_core/build`.
   - Python: `pytest pinn_surrogate/tests/` (100% PASSED).
   - Frontend: `npm run build` en `web_ui` (0 errores).
2. **Git Commit & Push:**
   - Ejecutar en `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D`:
     ```bash
     git add .
     git commit -m "refactor(core): 360-degree deep audit fixes in physics, JAX PINN loss, and 3D WebGL render"
     git push origin main
     ```
3. **Actualización del Tablero GitHub Projects (`Proyecto Tennessee`):**
   - Usar la herramienta `gh` para consultar y actualizar el estado de la tarjeta en el proyecto `PVT_kwHODxpfo84Bjd32`:
     ```bash
     env -u GITHUB_TOKEN gh project item-edit --id PVTI_lAHODxpfo84Bjd32zg643CU --field-id PVTSSF_lAHODxpfo84Bjd32zhiSEdk --project-id PVT_kwHODxpfo84Bjd32 --single-select-option-id 47fc9ee4
     ```
   - Si las pruebas E2E y numéricas superan el 100%, actualizar el estado a **`Done`** (`98236657`) o dejarlo en **`In Review`**.

---

## 📋 REGLAS INVARIANTES DE CALIDAD

1. **Cero Código Superficial o Parches de Síntomas:** Si se detecta un error de física o memoria, corrige la causa raíz subyacente.
2. **Evidencia Empírica Obligatoria:** Documenta las latencias encontradas (ms), las pérdidas Hamiltonianas ($\mathcal{L}$) y adjunta las rutas de las capturas de pantalla tomadas con `playwright-cli`.
3. **Preservación del Grafo de Obsidian:** Actualiza la bitácora de auditoría en `System_Logs/` y la nota maestro en `Proyectos/Compendio_Investigacion_Astroinformatica_PINNs_HPC.md`.
