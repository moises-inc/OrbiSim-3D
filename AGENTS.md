# AGENTS.md (OpenCode & Agent CLI Environment — AstroDynamics 3D)

Este archivo configura las reglas de comportamiento, autodeclaración de habilidades, asignación de subagentes y directrices de prevención de desbordamiento de tokens para OpenCode y Agent CLI en este repositorio.

---

## 🛠️ Descubrimiento de Habilidades (Agent Skills)

El sistema cuenta con el paquete de habilidades de desarrollo de software `agent-skills` instalado globalmente en:
`/home/moises/.gemini/config/plugins/agent-skills/skills/`

### Ciclo Obligatorio de Desarrollo:
1. **Analizar la Intención:** Mapear la solicitud de desarrollo con las 24 habilidades (especialmente `spec-driven-development`, `test-driven-development`, `frontend-ui-engineering`, `performance-optimization`).
2. **Ejecución TDD:** Todo código numérico o físico debe contar con su correspondiente suite de pruebas unitarias (`pytest` para Python/JAX, `GoogleTest` / `Catch2` para C++20).
3. **Calidad de Código Libre de Parches:** Tipado estricto en Python (`typing`), C++20 moderno y 0 parches de síntomas o fallbacks silenciosos.

---

## 🤖 Modelo de Ejecución Preferente & Subagentes

* **Modelo Táctico Recomendado (NVIDIA API / Gemini):**
  - **Coding Complejo / Core C++20 & JAX:** `nvidia/qwen/qwen3-coder-480b-a35b-instruct` o Gemini 3.8 / 3.6 Pro.
  - **Pruebas TDD & Depuración:** `nvidia/qwen/qwen2.5-coder-32b-instruct`.
  - **Razonamiento Extremo / Arquitectura:** `nvidia/nvidia/nemotron-3-ultra-550b-a55b`.
* **Subagentes de Auditoría en Tiempo de Ejecución:**
  - `e2e_browser_visual_qa_tester`: Auditor E2E de UI/UX en navegador real con `playwright-cli` (simulación de clics, visualización 3D WebGL, capturas en `/tmp/` e inspección de consola JS).
  - `scientific_runtime_accuracy_auditor`: Auditor de rigor físico, conservación de energía $H(p,q)$, momento angular $\vec{L}$ y precisión matemática.
  - `code_hpc_performance_auditor`: Auditor de latencias en ms, profiling de memoria C++/CUDA, paralelismo OpenMP y pruebas de carga.

---

## 🌐 Git Workflow & Automatización con GitHub CLI (`gh`)

1. Realizar commits atómicos en español/inglés con mensajes claros.
2. Hacer `git push origin main` al completar hitos.
3. Actualizar la tarjeta de **Proyecto Tennessee** (`PVT_kwHODxpfo84Bjd32`) vía `gh project item-edit` para reflejar avances.
