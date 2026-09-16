export function normalizeOptions(input = {}) {
  const unknown = Object.keys(input).filter(key => !['urls', 'widths', 'height', 'themes', 'timeout', 'wait', 'ready', 'out', 'a11y', 'screenshots', 'targetSize', 'failOn', 'ignore'].includes(key));
  if (unknown.length) throw new Error(`Unknown options: ${unknown.join(', ')}`);
  const list = (value, fallback) => Array.isArray(value) ? value : value === undefined ? fallback : String(value).split(',');
  const number = (value, fallback, min, max, name) => {
    const n = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
    return n;
  };
  const urls = list(input.urls, []).map(value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URLs must use HTTP(S), without embedded credentials.');
    return url.href;
  });
  if (!urls.length || urls.length > 50) throw new Error('Provide between 1 and 50 URLs.');
  const widths = [...new Set(list(input.widths, [375, 768, 1440]).map(w => number(w, 375, 240, 3840, 'width')))];
  const themes = [...new Set(list(input.themes, ['light', 'dark']))];
  if (!widths.length || widths.length > 12) throw new Error('Provide between 1 and 12 widths.');
  if (!themes.length || themes.some(t => !['light', 'dark'].includes(t))) throw new Error('themes must be light, dark, or light,dark.');
  const failOn = input.failOn ?? 'error';
  if (!['error', 'warning', 'none'].includes(failOn)) throw new Error('failOn must be error, warning, or none.');
  const ignore = list(input.ignore, []);
  if (ignore.some(s => typeof s !== 'string' || !s.trim())) throw new Error('ignore must contain CSS selectors.');
  for (const key of ['a11y', 'screenshots']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
  if (input.ready !== undefined && (typeof input.ready !== 'string' || !input.ready.trim())) throw new Error('ready must be a nonempty CSS selector.');
  if (input.out !== undefined && (typeof input.out !== 'string' || !input.out.trim())) throw new Error('out must be a nonempty directory path.');
  return { urls, widths, themes, failOn, ignore,
    height: number(input.height, 900, 240, 2160, 'height'),
    timeout: number(input.timeout, 30000, 100, 120000, 'timeout'),
    wait: number(input.wait, 500, 0, 10000, 'wait'),
    targetSize: number(input.targetSize, 24, 16, 100, 'targetSize'),
    ready: input.ready, out: input.out ?? 'layout-proof-results', a11y: input.a11y ?? true, screenshots: input.screenshots ?? true };
}

export function exitCode(report, failOn = report.options.failOn) {
  if (report.runs.some(r => r.status === 'error')) return 2;
  if (failOn === 'none') return 0;
  return report.runs.some(r => r.findings.some(f => f.severity === 'error' || failOn === 'warning')) ? 1 : 0;
}
