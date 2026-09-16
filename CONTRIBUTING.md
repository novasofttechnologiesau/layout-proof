# Contributing

Open an issue with the expected behavior, browser/runtime versions, viewport, and a small synthetic reproduction. Do not attach real customer data, credentials, private URLs, or reports containing sensitive content.

For changes, run `npm ci`, `npx playwright install chromium`, `npm test`, and `npm run check`. Add a regression test for corrected behavior. Keep the tool standalone; application-specific selectors and authentication belong in user configuration or future explicit adapters.

False positives matter: a layout rule should be advisory when intention cannot be established reliably. Keep the README's limits accurate. Do not describe passing automated checks as accessibility certification.
