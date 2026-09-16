import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptions, exitCode } from '../src/options.js';
import { renderReport } from '../src/report.js';
test('validates URLs, config types, enums and bounds before starting a browser', () => {
  const base = { urls: ['https://example.com'] };
  for (const options of [{ widths: 'abc' }, { urls: ['file:///tmp/page.html'] }, { urls: ['https://name:password@example.com'] }, { themes: 'sepia' }, { failOn: 'ignore' }, { typo: true }, { timeout: 0 }, { a11y: 'false' }, { ignore: [''] }, { widths: [] }]) assert.throws(() => normalizeOptions({ ...base, ...options }));
  assert.deepEqual(normalizeOptions({ ...base, widths: '375,375,1440' }).widths, [375, 1440]);
});
test('operational failures cannot be hidden by fail-on none', () => {
  const report = { options: { failOn: 'none' }, runs: [{ status: 'error', findings: [] }] };
  assert.equal(exitCode(report), 2);
  report.runs = [{ status: 'complete', findings: [{ severity: 'warning' }] }];
  assert.equal(exitCode(report, 'error'), 0);
  assert.equal(exitCode(report, 'warning'), 1);
});
test('untrusted page content is escaped and cannot execute in reports', () => {
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const html = renderReport({ toolVersion: '0.1.0', generatedAt: 'today', options: {}, runs: [{ url: hostile, width: 375, height: 900, theme: 'light', status: 'complete', findings: [{ selector: hostile, severity: 'error', message: hostile, rule: 'test' }], screenshot: '../../secret' }] });
  assert.ok(!html.includes(hostile));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('../../secret'));
  assert.ok(html.includes("default-src 'none'"));
});
