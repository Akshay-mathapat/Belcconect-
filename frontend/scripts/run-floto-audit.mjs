import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const phase = process.argv[2] || "before";

const outDir = path.resolve(frontendDir, "test-results", "floto-audit", phase);
const artifactDir = "C:\\Users\\AKSHAY MATHAPATI\\.gemini\\antigravity\\brain\\49efcffc-f642-44ca-9af8-4a5840420987\\screenshots";

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

const axePath = path.resolve(frontendDir, "node_modules", "axe-core", "axe.min.js");
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServer(proc, maxWaitMs = 30000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server did not print Ready within ${maxWaitMs}ms`));
      }
    }, maxWaitMs);

    proc.stdout.on("data", (d) => {
      const s = d.toString();
      console.log(`[DevServer:out] ${s.trim()}`);
      if (s.includes("Ready in") || s.includes("Local:")) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          setTimeout(() => resolve(true), 2000);
        }
      }
    });

    proc.stderr.on("data", (d) => {
      console.log(`[DevServer:err] ${d.toString().trim()}`);
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  try {
    console.log(`[Audit] Terminating dev server PID ${proc.pid}...`);
    execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
  } catch (e) {
    // ignore
  }
}

async function run() {
  console.log(`\n========================================`);
  console.log(` Starting Floto Audit Phase: [${phase.toUpperCase()}]`);
  console.log(`========================================\n`);

  const serverProc = spawn("npx", ["next", "dev", "--port", String(PORT), "--hostname", "localhost", "--webpack"], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "test" },
    shell: true,
    stdio: "pipe",
  });

  const serverReadyPromise = waitForServer(serverProc, 45000);

  serverProc.stdout.on("data", (d) => {
    console.log(`[DevServer:out] ${d.toString().trim()}`);
  });
  serverProc.stderr.on("data", (d) => {
    console.log(`[DevServer:err] ${d.toString().trim()}`);
  });

  try {
    await serverReadyPromise;

    const browser = await chromium.launch({ headless: true });

    // 1. Screenshots across viewports and 4 languages
    const viewports = [
      { name: "1440x900", width: 1440, height: 900, isMobile: false },
      { name: "390x844", width: 390, height: 844, isMobile: true },
    ];
    const languages = [
      { code: "en", name: "English" },
      { code: "hi", name: "Hindi" },
      { code: "kn", name: "Kannada" },
      { code: "mr", name: "Marathi" },
    ];

    console.log(`\n--- Capturing Screenshots for ${phase.toUpperCase()} ---`);
    for (const vp of viewports) {
      for (const lang of languages) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          deviceScaleFactor: 2,
        });
        const page = await context.newPage();

        await page.addInitScript(({ langCode }) => {
          localStorage.setItem("cityconnect:language", langCode);
          localStorage.setItem("cityconnect-locale", langCode);
          localStorage.setItem("cityconnect-tour-dismissed", "true");
          localStorage.setItem("cityconnect-theme", "light");
        }, { langCode: lang.code });

        let navigated = false;
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
            navigated = true;
            break;
          } catch (e) {
            console.log(`[Audit] page.goto attempt ${attempt} failed (${e.message}), retrying in 3s...`);
            await page.waitForTimeout(3000);
          }
        }
        if (!navigated) throw new Error("Failed to navigate after 4 attempts");
        await page.waitForTimeout(2000);

        const screenshotFileName = `${phase}_${vp.name}_${lang.code}.png`;
        const localPath = path.join(outDir, screenshotFileName);
        const artPath = path.join(artifactDir, screenshotFileName);

        await page.screenshot({ path: localPath, fullPage: true });
        fs.copyFileSync(localPath, artPath);

        console.log(`✓ Saved screenshot: ${screenshotFileName}`);
        await context.close();
      }
    }

    // 2. Axe-Core Accessibility Audits (Light & Dark x Desktop & Mobile)
    console.log(`\n--- Running Axe-Core Accessibility Audits ---`);
    const axeConfigs = [
      { theme: "light", vp: viewports[0] }, // 1440x900 light
      { theme: "dark", vp: viewports[0] },  // 1440x900 dark
      { theme: "light", vp: viewports[1] }, // 390x844 light
      { theme: "dark", vp: viewports[1] },  // 390x844 dark
    ];

    const axeSummary = [];

    for (const cfg of axeConfigs) {
      const context = await browser.newContext({
        viewport: { width: cfg.vp.width, height: cfg.vp.height },
        isMobile: cfg.vp.isMobile,
      });
      const page = await context.newPage();

      await page.addInitScript(({ themeName }) => {
        localStorage.setItem("cityconnect:language", "en");
        localStorage.setItem("cityconnect-locale", "en");
        localStorage.setItem("cityconnect-tour-dismissed", "true");
        localStorage.setItem("cityconnect-theme", themeName);
      }, { themeName: cfg.theme });

      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      // Inject axe-core
      await page.addScriptTag({ path: axePath });

      const axeResults = await page.evaluate(async () => {
        // @ts-ignore
        return await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        });
      });

      const reportName = `axe_${phase}_${cfg.vp.name}_${cfg.theme}.json`;
      fs.writeFileSync(path.join(outDir, reportName), JSON.stringify(axeResults, null, 2));

      const violationsCount = axeResults.violations.length;
      console.log(`[Axe] ${cfg.vp.name} (${cfg.theme}): ${violationsCount} violation(s) found`);

      for (const v of axeResults.violations) {
        console.log(`   - [${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} element(s))`);
        for (const n of v.nodes.slice(0, 3)) {
          console.log(`       Target: ${n.target.join(", ")} | Summary: ${n.failureSummary?.replace(/\n/g, " ")}`);
        }
      }

      axeSummary.push({
        phase,
        viewport: cfg.vp.name,
        theme: cfg.theme,
        violationsCount,
        violations: axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          nodeCount: v.nodes.length,
          sampleTargets: v.nodes.map((n) => n.target.join(", ")).slice(0, 5),
          summaries: v.nodes.map((n) => n.failureSummary).slice(0, 3),
        })),
      });

      await context.close();
    }

    fs.writeFileSync(
      path.join(outDir, `axe_summary_${phase}.json`),
      JSON.stringify(axeSummary, null, 2)
    );

    // 3. Structural & Semantic Checks (Single H1, Duplicate IDs, Tour Targets)
    console.log(`\n--- Running Structural & Semantic Checks ---`);
    const checkContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const checkPage = await checkContext.newPage();
    await checkPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await checkPage.waitForTimeout(1500);

    // H1 check
    const h1Count = await checkPage.locator("h1").count();
    const h1Texts = await checkPage.locator("h1").allInnerTexts();
    console.log(`[Heading Check] H1 count: ${h1Count}. Content: "${h1Texts.join(" | ")}"`);

    // Duplicate ID check
    const duplicateIds = await checkPage.evaluate(() => {
      const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
      const seen = new Set();
      const duplicates = new Set();
      for (const id of ids) {
        if (!id) continue;
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
      }
      return Array.from(duplicates);
    });
    console.log(`[Duplicate ID Check] Duplicate IDs found: ${duplicateIds.length === 0 ? "NONE (Clean)" : duplicateIds.join(", ")}`);

    // Tour Targets Check
    const tourTargets = [
      "customer-search",
      "browse-services",
      "search-bar",
      "language-switcher",
      "mobile-menu",
    ];
    console.log(`[Tour Targets Resolution on Homepage (1440x900)]`);
    for (const target of tourTargets) {
      const loc = checkPage.locator(`[data-tour="${target}"]`);
      const count = await loc.count();
      const isVisible = count > 0 ? await loc.first().isVisible() : false;
      console.log(`   data-tour="${target}": count=${count}, isVisible=${isVisible}`);
    }

    // Keyboard navigation walkthrough
    console.log(`\n--- Keyboard Navigation Walkthrough ---`);
    await checkPage.keyboard.press("Tab");
    const active1 = await checkPage.evaluate(() => document.activeElement?.tagName + (document.activeElement?.id ? `#${document.activeElement.id}` : "") + (document.activeElement?.className ? `.${document.activeElement.className.split(" ")[0]}` : ""));
    console.log(`[Keyboard Tab 1] Focused: <${active1}>`);

    await checkPage.keyboard.press("Tab");
    const active2 = await checkPage.evaluate(() => document.activeElement?.tagName + (document.activeElement?.id ? `#${document.activeElement.id}` : "") + (document.activeElement?.className ? `.${document.activeElement.className.split(" ")[0]}` : ""));
    console.log(`[Keyboard Tab 2] Focused: <${active2}>`);

    await checkContext.close();
    await browser.close();

    console.log(`\n========================================`);
    console.log(` Floto Audit Phase [${phase.toUpperCase()}] COMPLETE!`);
    console.log(`========================================\n`);
  } finally {
    killProcess(serverProc);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR IN AUDIT RUNNER:", err);
  process.exit(1);
});
