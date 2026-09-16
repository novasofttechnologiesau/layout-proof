// This function is serialized into the inspected page. Keep it self-contained.
export function inspectLayout({ targetSize, ignore }) {
  const findings = [];
  const viewport = document.documentElement.clientWidth;
  const selectors = element => {
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) return `#${CSS.escape(element.id)}`;
    const parts = [];
    for (let current = element; current && current.nodeType === 1; current = current.parentElement) {
      const tag = current.localName;
      const siblings = current.parentElement ? [...current.parentElement.children].filter(e => e.localName === tag) : [];
      parts.unshift(tag + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''));
      if (current === document.documentElement) break;
    }
    return parts.join(' > ');
  };
  // Validate selectors before inspecting, so a typo never silently disables checks.
  ignore.forEach(selector => document.querySelector(selector));
  const ignored = element => ignore.some(selector => element.closest(selector));
  const visible = element => {
    if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let p = element; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const bounds = element => {
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) };
  };
  const push = (element, rule, severity, message) => findings.push({ rule, severity, selector: selectors(element), message, bounds: bounds(element) });
  const clippedBy = element => {
    const r = element.getBoundingClientRect();
    for (let p = element.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p), pr = p.getBoundingClientRect();
      if (/(auto|scroll)/.test(s.overflowX) && (r.left < pr.left - 1 || r.right > pr.right + 1)) return 'scroll';
      if (/(hidden|clip)/.test(s.overflowX) && (r.left < pr.left - 1 || r.right > pr.right + 1)) return 'clip';
    }
    return null;
  };
  const controls = 'button,input:not([type="hidden"]),select,textarea,a[href],summary,[role="button"],[tabindex]:not([tabindex="-1"])';
  const hasPageOverflow = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) > viewport + 1;
  if (hasPageOverflow) push(document.documentElement, 'page-overflow', 'error', `Document is wider than its ${viewport}px viewport.`);
  for (const element of document.body.querySelectorAll('*')) {
    if (!visible(element) || ignored(element)) continue;
    const rect = element.getBoundingClientRect();
    const clip = clippedBy(element);
    const interactive = element.matches(controls) && !element.matches(':disabled');
    if (interactive && clip === 'clip') push(element, 'clipped-control', 'warning', 'An ancestor clips this control horizontally. Check whether it can be used.');
    if ((rect.left < -1 || rect.right > viewport + 1) && !clip) {
      push(element, 'outside-viewport', hasPageOverflow ? 'error' : 'warning', 'Element extends beyond the horizontal viewport. Review intentional off-canvas content.');
    }
    if (interactive && (rect.width < targetSize || rect.height < targetSize) && rect.right > 0 && rect.left < viewport && !clip) {
      push(element, 'small-target', 'warning', `Control is ${Math.round(rect.width)} × ${Math.round(rect.height)}px; configured minimum is ${targetSize}px. Spacing and inline-link exceptions require manual review.`);
    }
  }
  return { viewport, documentWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0), findings };
}
