import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectLayout } from './inspect.js';
import { normalizeOptions, exitCode } from './options.js';
import { renderReport } from './report.js';

export { normalizeOptions, exitCode };
export async function audit(input) {
  const options = normalizeOptions(input);
  // Unique directories prevent stale evidence and accidental overwrites.
  const directory = resolve(options.out, `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
  await mkdir(directory, { recursive: true });
  const report = { version: 1, toolVersion: '0.1.0', generatedAt: new Date().toISOString(), options, runs: [] };
  const browser = await chromium.launch();
  try {
    for (const url of options.urls) for (const width of options.widths) for (const theme of options.themes) {
      const run = { url, width, height: options.height, theme, status: 'complete', findings: [], screenshot: null };
      report.runs.push(run);
      const context = await browser.newContext({ viewport: { width, height: options.height }, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: false });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(options.timeout);
        page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeout });
        run.finalUrl = page.url();
        if (!response || response.status() >= 400) throw new Error(`Navigation returned HTTP ${response?.status() ?? 'unknown'}.`);
        if (options.ready) await page.locator(options.ready).first().waitFor({ state: 'visible' });
        await page.waitForTimeout(options.wait);
        Object.assign(run, await page.evaluate(inspectLayout, options));
        if (options.a11y) {
          let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
          for (const selector of options.ignore) builder = builder.exclude(selector);
          const results = await builder.analyze();
          run.accessibility = { violations: results.violations.length, incomplete: results.incomplete.length };
          for (const violation of results.violations) for (const node of violation.nodes) {
            run.findings.push({ rule: `axe:${violation.id}`, severity: ['serious', 'critical'].includes(violation.impact) ? 'error' : 'warning', selector: node.target.map(s => Array.isArray(s) ? s.join(' >> ') : s).join(' >> '), message: violation.help, helpUrl: violation.helpUrl });
          }
        }
        if (options.screenshots) {
          run.screenshot = `viewport-${String(report.runs.length).padStart(3, '0')}.png`;
          await page.screenshot({ path: join(directory, run.screenshot), fullPage: false, timeout: options.timeout });
        }
      } catch (error) {
        run.status = 'error';
        run.error = error.message;
        run.screenshot = null;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  report.exitCode = exitCode(report);
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(directory, 'index.html'), renderReport(report));
  return { report, directory };
}
