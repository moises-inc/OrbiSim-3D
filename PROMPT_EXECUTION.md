# 🚀 PROMPT DE EJECUCIÓN PARA OPENCODE / AGENT CLI (GEMINI 3.8 & NVIDIA MODELS)

```markdown
# TAREA TÁCTICA PARA OPENCODE / AGENT CLI: Desarrollo Core & Frontend OrbiSim-3D

## 📌 Contexto & Proyecto
- **Proyecto:** OrbiSim-3D (`moises-inc/OrbiSim-3D`) — Flagship App #1 de Proyecto Tennessee
- **Ruta Absoluta de Ejecución:** `/mnt/9b846436-0407-4e80-b8af-5417ffbdee8e/Astro/OrbiSim-3D`
- **Modelos Preferentes (NVIDIA API / Gemini):**
  - **Lógica Compleja / Core C++20 & JAX:** `nvidia/qwen/qwen3-coder-480b-a35b-instruct` (o Gemini 3.8 Pro).
  - **Pruebas TDD & Depuración:** `nvidia/qwen/qwen2.5-coder-32b-instruct`.
  - **Razonamiento Extremo:** `nvidia/nvidia/nemotron-3-ultra-550b-a55b`.

---

## 🎯 Objetivos Específicos de Desarrollo

### 1. Core C++20 (`cpp_core/`)
- Construir la estructura CMake en `cpp_core/CMakeLists.txt` con flags `-std=c++20 -O3 -fopenmp`.
- Implementar `nbody_solver.cpp` y `nbody_solver.hpp` integrando Runge-Kutta 4º Orden y Verlet Simpléctico.
- Desarrollar suite de pruebas unitarias en C++ (`cpp_core/tests/test_nbody.cpp`) verificando la conservación del centro de masa y la energía total.

### 2. Capa PINN Simpléctica (`pinn_surrogate/`)
- Implementar `model.py` en JAX / PyTorch definiendo la arquitectura del Hamiltoniano $H_{\theta}(q,p)$.
- Definir la función de pérdida simpléctica $\mathcal{L}_{\text{symplectic}} = \|\nabla_p H - \dot{q}\|^2 + \|\nabla_q H + \dot{p}\|^2$.
- Desarrollar `test_pinn_conservation.py` en `pytest` para certificar la estabilidad de energía en 1,000+ pasos.

### 3. Frontend WebGL 3D (`web_ui/`)
- Inicializar aplicación React 19 + TypeScript + Three.js (`@react-three/fiber`).
- Crear el componente `OrbitCanvas3D.tsx` para renderizar partículas astronómicas, órbitas 3D e iluminación.
- Crear `ControlsPanel.tsx` para modificar masa $m$, velocidad inicial $\vec{v}_0$ y constante gravitacional $G$.

---

## 🛠️ Directivas de Ejecución & Git Workflow

1. **Uso Autónomo de Subagentes:**
   - Invocar `subagent-code-runtime-auditor` para auditar el rendimiento del bucle de integración numérico en C++.
   - Invocar `subagent-scientific-accuracy-checker` para auditar la precisión física de la loss Hamiltoniana.
2. **Ciclo TDD Invariante:**
   - No dar ninguna fase por completada sin antes ejecutar `pytest` y los binarios de prueba compilados.
3. **Persistencia Git & GitHub CLI:**
   - Realizar commits atómicos con mensajes claros en inglés.
   - Ejecutar `git push origin main`.
   - Actualizar el estado de la tarjeta en **Proyecto Tennessee** (`PVT_kwHODxpfo84Bjd32`) usando `gh project item-edit`.
```
