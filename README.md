# Layout Proof

Find the elements breaking your responsive layout. Audit URLs at multiple widths and color schemes, then open a local HTML report with selectors, dimensions, screenshots, and JSON evidence.

**Early release, v0.1.0.** Chromium only. No account, hosted service, telemetry, or application integration required. MIT licensed.

## Get started

Requires Node.js 22 or newer. This project is distributed through GitHub; it is not published to npm.

```sh
git clone https://github.com/novasofttechnologiesau/layout-proof.git
cd layout-proof
npm ci
npx playwright install chromium
node bin/layout-proof.js https://example.com
```

On Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`. Playwright supports specific operating systems; see its [system requirements](https://playwright.dev/docs/intro#system-requirements).

Open the `index.html` path printed by the command. Each run uses a new output directory beneath `layout-proof-results/`, so previous results are preserved. Keep the report beside its JSON and PNG files when sharing it.

## Try the synthetic demo

Start the demo server in one terminal:

```sh
npm run demo
```

In a second terminal:

```sh
node bin/layout-proof.js http://127.0.0.1:4173/broken --no-a11y
node bin/layout-proof.js http://127.0.0.1:4173/clean --no-a11y
```

The broken page intentionally produces findings and exit code 1. The clean page includes a legitimate horizontal scroll region, which should not be reported as page overflow.

## Checks

- **Page overflow:** document width exceeds the viewport.
- **Outside viewport:** identifies visible DOM elements extending beyond the horizontal viewport. Intentionally scrollable or clipped ancestors are considered.
- **Clipped controls:** advisory warning when an ancestor hides part of a control horizontally.
- **Small targets:** advisory size check, configurable in pixels. Defaults to 24px. Spacing and inline-link exceptions are not evaluated; this is not a WCAG conformance verdict.
- **Accessibility:** axe-core rules tagged `wcag2a`, `wcag2aa`, and `wcag21aa`. Serious/critical violations are errors; other impacts are warnings. The report also records the count of axe checks needing manual review.

Layout Proof combines custom layout heuristics with [Playwright](https://playwright.dev/) and [axe-core](https://github.com/dequelabs/axe-core). Automated checks cannot establish accessibility compliance.

## Configuration

```sh
node bin/layout-proof.js https://example.com https://example.com/about \
  --widths 375,768,1440 --themes light,dark --target-size 44 \
  --ready main --wait 800 --fail-on warning
```

For repeatable checks, use a JSON configuration:

```json
{
  "urls": ["http://127.0.0.1:4173/clean"],
  "widths": [375, 768, 1440],
  "height": 900,
  "themes": ["light", "dark"],
  "ready": "main",
  "wait": 500,
  "timeout": 30000,
  "targetSize": 24,
  "ignore": [".intentional-offcanvas"],
  "a11y": true,
  "screenshots": true,
  "failOn": "error",
  "out": "layout-proof-results"
}
```

```sh
node bin/layout-proof.js --config layout-proof.json
```

CLI options override configuration values; positional URLs replace the configured URL list. Paths resolve from the working directory. Unknown options and invalid CSS exclusions fail explicitly. `--ignore` excludes matching elements and descendants from element checks and axe; it never suppresses document-level overflow. Repeat `--ignore` for multiple selectors. Run `--help` for all flags.

### Exit codes

- **0:** completed below the configured failure threshold.
- **1:** findings met the threshold (`error` by default, or `warning`).
- **2:** configuration, navigation, browser, or scan failure. Partial findings may still be available.

`--fail-on none` allows findings without failing CI, but never hides execution failures. Use `--no-a11y` or `--no-screenshots` to disable those features explicitly.

### Programmatic use

```js
import { audit } from './src/audit.js';
const { report, directory } = await audit({
  urls: ['http://127.0.0.1:4173/clean'],
  widths: [375, 1440],
  themes: ['light']
});
console.log(directory, report.exitCode);
```

## GitHub Actions

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for this project's tests. In a project where Layout Proof is installed as a dependency, a typical audit step is:

```yaml
- run: npx playwright install --with-deps chromium
- run: npx layout-proof http://127.0.0.1:3000 --out layout-proof-results
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: layout-proof-report
    path: layout-proof-results/
```

Start your application and wait for readiness before the audit. Until an npm release exists, install from a reviewed Git commit, for example `npm install --save-dev github:novasofttechnologiesau/layout-proof#<commit-sha>`. Use your own reviewed dependency/version policy for third-party Actions.

## Limits and privacy

- Checks inspect each URL's initial rendered state. There is no crawler, login flow, automatic clicking, visual baseline comparison, or complete keyboard audit.
- Themes use `prefers-color-scheme`; applications using their own theme switches need separate test URLs or application setup.
- Layout heuristics cover the top document's regular DOM, not shadow trees or iframe contents. Axe has its own frame/shadow support. Vertical clipping, overlays, canvas content, and every CSS edge case are not covered.
- Off-canvas navigation and decorative elements can produce false positives. Review findings and use narrow exclusions. A fixed settle time can miss late content; use `--ready` and adjust `--wait`.
- Screenshots capture the initial viewport, not the full page. Coordinates include below-the-fold elements. Large pages may produce many related findings; results are not deduplicated into root causes.
- Reports contain URLs, selectors, error messages, and screenshots from the inspected website. Query parameters and page content are **not redacted**. Keep results private when inspecting sensitive applications. Do not commit generated reports by default.
- Pages execute JavaScript and can contact services reachable from the machine running Chromium. This CLI is for trusted developer-controlled targets, not a public URL-scanning service. It does not share your normal browser session.
- The report itself has no scripts, remote assets, or telemetry. Its HTML escapes page-derived text and uses a restrictive content security policy.

## Development

```sh
npm ci
npx playwright install chromium
npm test
npm run check
npm pack --dry-run
```

Tests use only synthetic loopback pages. They cover expected failures, healthy layouts, exclusions, navigation errors, report escaping, report accessibility, and CLI exit behavior. Contributions should include a minimal synthetic reproduction and a regression test. See [CONTRIBUTING.md](CONTRIBUTING.md).
