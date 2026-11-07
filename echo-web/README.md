# ECHO integration for the productivity portal

The portal loads the ECHO website assistant after login. Current main supports a built-in TypeScript help engine
and an optional external ECHO service. The built-in engine is separate from the source project's Python engine;
model-provider credentials stay on the backend. Integration planning and the master handoff live in `docs/` here.

## Configure

By default the current portal uses `/api/echo`, with approved static workflow guidance and optional provider
generation when `OPENAI_API_KEY` is supplied to the server. Set `ECHO_CHAT_ENABLED=false` to disable it. Review
the production gates in `docs/PENDING_WORK.md` before public hosting. For a dedicated external ECHO service:

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

## Local assistance and response controls

- Page suggestions use the existing route/control registry and the signed-in role. “Help with this page” and
  “What filters are selected?” describe validated local view state without a model call or record lookup.
- Navigation replies wait for matching React router and browser URL state; year changes wait for matching
  selector state. Failure to confirm within two seconds produces a failure message. Confirmation covers view
  state, not completion of page data loading or any database change.
- Stop aborts the browser request and discards its conversation token. The next message starts a fresh remote
  conversation so an unseen partial turn cannot affect later answers. Existing visible messages remain until
  New chat. Remote cancellation/billing depends on the configured backend; abandoned sessions expire there.
- Copy is explicit and available on completed assistant messages. Clipboard denial shows an actionable message.
- Transcript and tokens remain in memory; logout destroys the widget. No persistent chat storage is added.
- A 45-second browser deadline stops an unresponsive chat request; there is no automatic message replay.

## Upstream widget

The widget comes from `echo-assistant-project/Echo` commit
`e094251b8cf82b05bfb3f37831b40bda6bfacd4c`, path `echo-web/widget/widget.js`.
The portal adds an instance identifier, a cancelled-start guard and an `echo-widget:destroy` event for React
logout cleanup. The portal also adds local context suggestions, verified command replies, Stop and copy controls.
Keep these adaptations when refreshing the pinned asset. The Python conversation engine is not vendored here.

## Checks and rollout

Use Node 22.5 or newer for the existing `node:sqlite` adapter. Dependencies are already installed in the audited
checkout; reinstall only when needed.

```powershell
npm ci
npm run test:echo
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:echo:browser
```

The browser check uses an installed Chrome/Chromium/Edge and a local fake ECHO service. It exercises the real
portal login, chat startup, streaming, navigation, context, Stop/copy, mobile layout, logout cleanup and account
isolation. It also tests the actual built-in static help engine over HTTP with the provider key disabled. Neither
check proves a live provider integration. Set `ECHO_BROWSER` if discovery needs help. Browser artifacts and
temporary test-generated SQLite files are ignored; the harness terminates its services and removes its temp DB.

Before launch, approve real help content, HTTPS/allowed origins, CSP script/connect/style requirements, service
quotas, privacy notice, support ownership and the ECHO service's production gates. Test with the actual provider
and supported client browsers. To roll back, set `ECHO_CHAT_ENABLED=false` and restart Express, then reload the
portal. The existing school modules continue through their original APIs.
