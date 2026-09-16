#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { audit } from '../src/audit.js';

const HELP = `Layout Proof 0.1.0
Usage: layout-proof <url> [more urls] [options]

  --config FILE        JSON configuration; CLI options override it
  --widths LIST        Comma-separated widths (375,768,1440)
  --height NUMBER      Viewport height (900)
  --themes LIST        light,dark (prefers-color-scheme)
  --out DIRECTORY      Parent output directory (layout-proof-results)
  --ready SELECTOR     Wait for a visible CSS selector
  --wait NUMBER        Settle time in milliseconds (500)
  --timeout NUMBER     Navigation and action timeout in milliseconds (30000)
  --target-size NUMBER Advisory target size in pixels (24)
  --ignore SELECTOR    Exclude a selector and its descendants; repeatable
  --fail-on LEVEL      error, warning, or none (error)
  --no-a11y            Skip axe accessibility checks
  --no-screenshots     Omit viewport screenshots
  --help               Show help
  --version            Show version

Exit codes: 0 = below threshold, 1 = findings, 2 = execution/config error.
Install Chromium first: npx playwright install chromium
`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string' }, widths: { type: 'string' }, height: { type: 'string' }, themes: { type: 'string' }, out: { type: 'string' }, ready: { type: 'string' }, wait: { type: 'string' }, timeout: { type: 'string' }, 'target-size': { type: 'string' }, ignore: { type: 'string', multiple: true }, 'fail-on': { type: 'string' }, 'no-a11y': { type: 'boolean' }, 'no-screenshots': { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' }
  } });
  if (values.help || values.version) {
    console.log(values.version ? '0.1.0' : HELP);
  } else {
    const config = values.config ? JSON.parse(await readFile(values.config, 'utf8')) : {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Configuration must be a JSON object.');
    const cli = {};
    for (const key of ['widths', 'height', 'themes', 'out', 'ready', 'wait', 'timeout', 'ignore']) if (values[key] !== undefined) cli[key] = values[key];
    if (values['target-size'] !== undefined) cli.targetSize = values['target-size'];
    if (values['fail-on'] !== undefined) cli.failOn = values['fail-on'];
    if (values['no-a11y']) cli.a11y = false;
    if (values['no-screenshots']) cli.screenshots = false;
    if (positionals.length) cli.urls = positionals;
    const { report, directory } = await audit({ ...config, ...cli });
    const count = report.runs.reduce((sum, run) => sum + run.findings.length, 0);
    console.log(`${report.runs.length} viewport/theme runs; ${count} findings; ${report.runs.filter(r => r.status === 'error').length} execution errors.`);
    console.log(`Report: ${directory}/index.html`);
    process.exitCode = report.exitCode;
  }
} catch (error) {
  console.error(`Layout Proof: ${error.message}`);
  process.exitCode = 2;
}
