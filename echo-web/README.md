# ECHO integration for the productivity portal

The portal loads the ECHO website assistant after login. The existing ECHO service remains the authoritative
conversation engine. This repository contains its pinned browser widget and the portal integration, with no
duplicate model engine and no model-provider credentials in the frontend.

## Configure

1. Provision the tested ECHO service from `echo-assistant-project/Echo/echo-web`. Follow that repository's hosting
   prerequisites before production. Model credentials are configured on that service only.
2. Add the reviewed client entry from `clients/productivity.example.json` to the service's configuration. Replace
   the example production origin with the real portal origin, and approve the greeting and public help content.
3. Set these environment variables in the Express server process, then restart that process:

```text
ECHO_CHAT_ENABLED=true
ECHO_SITE_ID=productivity-portal
ECHO_API_URL=https://your-echo-api.example.com
```

The root `.env.example` lists placeholders. The existing app does not automatically load `.env` files. Supply
variables through the hosting platform or process environment. Development permits a loopback HTTP API such as
`http://127.0.0.1:8765`; production requires HTTPS. Leave `ECHO_CHAT_ENABLED=false` to keep chat disabled until the
service is configured. Building or merging the source does not provision or deploy that service.

## How it works

- `server/services/echo.ts` validates public widget configuration. `/api/echo/config` uses the existing portal
  authentication middleware and returns only enablement, the public site ID and API origin.
- `src/components/EchoAssistant.tsx` loads the local widget asset once per signed-in account. It aborts startup
  and destroys the widget on logout/account changes, including its pending requests and in-memory chat token.
- `echo-web/widget/widget.js` sends typed messages directly to the configured ECHO service with independent
  conversation tokens and `credentials: omit`. Portal login tokens and cookies are not forwarded.
- The service handles isolated sessions, approved client knowledge, streaming and model credentials. The public
  site ID is configuration, not authentication. Use approved public help content until the service supports any
  additional access controls needed for private knowledge.

No school database records, profiles, marks, attendance, messages or portal actions are supplied automatically
to ECHO. The initial scope is general portal-navigation help. A user can still type personal information into a
chat, so approve the service's data-handling notice and provider policy before launch.

## Upstream widget

The widget comes from `echo-assistant-project/Echo` commit
`e094251b8cf82b05bfb3f37831b40bda6bfacd4c`, path `echo-web/widget/widget.js`.
The portal adds an instance identifier, a cancelled-start guard and an `echo-widget:destroy` event for React
logout cleanup. Keep these lifecycle adaptations when refreshing the pinned asset. The conversation engine is
never vendored into this repository.

## Checks and rollout

Use Node 22 LTS with the repository's existing SQLite native dependency.

```powershell
npm ci
npm run test:echo
npm run build
npm run test:echo:browser
```

The browser check uses an installed Chrome/Chromium/Edge and a local fake ECHO service. It exercises the real
portal login, chat startup, streaming, navigation, logout cleanup and account isolation. Set `ECHO_BROWSER` if
browser discovery needs help. Browser artifacts and test-generated SQLite files are ignored.

Before launch, approve real help content, HTTPS/allowed origins, CSP script/connect/style requirements, service
quotas, privacy notice, support ownership and the ECHO service's production gates. Test with the actual provider
and supported client browsers. To roll back, set `ECHO_CHAT_ENABLED=false` and restart Express, then reload the
portal. The existing school modules continue through their original APIs.
