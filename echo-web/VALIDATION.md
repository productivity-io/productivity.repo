# Validation

Checked on November 6, 2026 with isolated Node 22.23.4, TypeScript and installed Google Chrome on Windows.

- Five configuration tests passed for default disablement, public metadata, site IDs, URL constraints and production HTTPS.
- The full existing application production build passed.
- TypeScript checking passed for the existing frontend/backend and the integration.
- The browser integration passed using the built portal, its real Express authentication and a fake ECHO HTTP/SSE service.
- Browser checks covered login-gated loading, authenticated configuration, chat follow-ups, existing assignments navigation,
  single-widget ownership, cancellation of an active reply on logout, separate sessions for a second account, disabled
  configuration, and absence of portal tokens/cookies or record requests in ECHO service traffic.
- Test authentication used the existing synthetic demo seed in a temporary test database. Existing local databases were not used.
- Widget JavaScript syntax and patch whitespace checks passed. No provider key is included in the browser widget or public configuration.

The model engine remains hosted by the separate ECHO service. Its earlier live-model/API tests are recorded in that
repository. This portal check does not provision a live service or establish production readiness. A real HTTPS API,
matching allowed origins, approved help content, data-handling notice and hosting review are needed before enabling
the production feature. This change does not read or modify school records through ECHO.
