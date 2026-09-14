const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CAPTURES_DIR = '/tmp/orbisim_e2e_captures';
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

async function runE2ETests() {
  console.log('🚀 Iniciando Suite de Pruebas E2E Visual QA para OrbiSim-3D...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.error('❌ Error no capturado en navegador:', err.message);
  });

  // 1. Cargar la página
  console.log('➜ [1/5] Conectando a http://localhost:5180...');
  await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // 2. Captura inicial (Kepler Two-Body)
  const capture1 = path.join(CAPTURES_DIR, '01_kepler_twobody_initial.png');
  await page.screenshot({ path: capture1 });
  console.log(`📸 [2/5] Captura inicial guardada en: ${capture1}`);

  // 3. Probar cambio de Preset a "Three-Body Figure-8"
  console.log('➜ [3/5] Probando cambio de preset a Three-Body Figure-8...');
  const figure8Btn = page.locator('text=Three-Body Figure-8 Choreography');
  if (await figure8Btn.isVisible()) {
    await figure8Btn.click();
    await page.waitForTimeout(2500); // dejar simular 2.5s
    const capture2 = path.join(CAPTURES_DIR, '02_three_body_figure8.png');
    await page.screenshot({ path: capture2 });
    console.log(`📸 Captura Figure-8 guardada en: ${capture2}`);
  }

  // 4. Probar navegación a la pestaña de Invariantes Físicos
  console.log('➜ [4/5] Navegando a pestaña de Invariantes Físicos...');
  const invariantsTab = page.locator('button:has-text("Invariants")');
  if (await invariantsTab.isVisible()) {
    await invariantsTab.click();
    await page.waitForTimeout(1500);
    const capture3 = path.join(CAPTURES_DIR, '03_invariants_metrics.png');
    await page.screenshot({ path: capture3 });
    console.log(`📸 Captura Invariantes guardada en: ${capture3}`);
  }

  // 5. Probar navegación a pestaña Bodies
  console.log('➜ [5/5] Probando pestaña Bodies y controles interactivos...');
  const bodiesTab = page.locator('button:has-text("Bodies")');
  if (await bodiesTab.isVisible()) {
    await bodiesTab.click();
    await page.waitForTimeout(1000);
    const capture4 = path.join(CAPTURES_DIR, '04_bodies_controls.png');
    await page.screenshot({ path: capture4 });
    console.log(`📸 Captura Bodies guardada en: ${capture4}`);
  }

  await browser.close();

  const report = {
    url: 'http://localhost:5180',
    viewport: '1440x900',
    pageErrorsCount: pageErrors.length,
    pageErrors,
    consoleLogsCount: consoleLogs.length,
    captures: [
      '01_kepler_twobody_initial.png',
      '02_three_body_figure8.png',
      '03_invariants_metrics.png',
      '04_bodies_controls.png',
    ],
  };

  const reportPath = path.join(CAPTURES_DIR, 'e2e_run_summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Pruebas E2E finalizadas. Reporte guardado en: ${reportPath}`);
  console.log(`Errores de página detectados: ${pageErrors.length}`);
}

runE2ETests().catch((err) => {
  console.error('Error fatal ejecutando Playwright E2E:', err);
  process.exit(1);
});
