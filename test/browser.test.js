import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createDemoServer, fixture } from '../examples/server.js';
import { audit } from '../src/audit.js';
import { inspectLayout } from '../src/inspect.js';

test('real browser finds defects, excludes scroll regions, renders accessible reports and signals failures', async () => {
  const out = await mkdtemp(join(tmpdir(), 'layout-proof-test-'));
  const server = createDemoServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch();
    const result = await audit({ urls: [`${base}/broken`, `${base}/clean`, `${base}/missing`], widths: [375, 1800], themes: ['light'], out, wait: 0, a11y: false });
    assert.equal(result.report.runs.length, 6);
    assert.equal(result.report.exitCode, 2);
    const broken = result.report.runs[0];
    assert.ok(broken.findings.some(f => f.selector === '#wide' && f.rule === 'outside-viewport'));
    assert.ok(broken.findings.some(f => f.selector === '#tiny' && f.rule === 'small-target'));
    assert.ok(broken.findings.some(f => f.selector === '#clipped' && f.rule === 'clipped-control'));
    assert.equal(result.report.runs[1].findings.some(f => f.rule === 'page-overflow'), false);
    assert.deepEqual(result.report.runs[2].findings, []);
    assert.equal(result.report.runs[4].status, 'error');
    const html = await readFile(join(result.directory, 'index.html'), 'utf8');
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      // Serve the report over HTTP so axe can inspect its document and frames.
      await page.route(`${base}/report`, route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(`${base}/report`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const axe = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(axe.violations.map(v => v.id), []);
      await context.close();
    }
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    await page.setContent(fixture('broken'));
    const ignored = await page.evaluate(inspectLayout, { targetSize: 24, ignore: ['#tiny', '#wide'] });
    assert.ok(!ignored.findings.some(f => ['#tiny', '#wide'].includes(f.selector)));
    assert.ok(ignored.findings.some(f => f.rule === 'page-overflow'));
    await assert.rejects(page.evaluate(inspectLayout, { targetSize: 24, ignore: ['???'] }));
    await page.close();
    const audited = await audit({ urls: [`${base}/clean`], widths: [375], themes: ['dark'], out, wait: 0, screenshots: false });
    assert.equal(audited.report.exitCode, 0, JSON.stringify(audited.report.runs, null, 2));
    assert.ok(audited.report.runs[0].accessibility);
    const child = spawn(process.execPath, ['bin/layout-proof.js', `${base}/broken`, '--widths', '375', '--themes', 'light', '--no-a11y', '--no-screenshots', '--wait', '0', '--out', out]);
    let stdout = ''; child.stdout.on('data', data => stdout += data); child.stderr.resume();
    const [code] = await once(child, 'close');
    assert.equal(code, 1); assert.match(stdout, /Report:/);
  } finally { await browser?.close(); server.close(); await rm(out, { recursive: true, force: true }); }
});
