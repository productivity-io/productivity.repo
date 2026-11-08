# ECHO integration for the productivity portal

ECHO is the signed-in portal assistant. The production path is the built-in
TypeScript service at `/api/echo`, not a separate Python service.

## Architecture

1. **Signed-in identity.** `/api/echo/config` and every session endpoint require
   the portal's authenticated user. ECHO session tokens are bound to the account
   `sub` and expire after 30 minutes. Logout/account changes destroy the widget.
2. **Deterministic commands first.** Typo-tolerant navigation, filters, search,
   academic-year changes and "where am I" resolve locally against registered
   routes and role permissions. Commands never call a model and never perform
   sensitive or destructive actions.
3. **FreeLLMAPI is the primary conversational brain.** Natural conversation,
   follow-ups and explanations go to the FreeLLMAPI OpenAI-compatible gateway.
   The default model is `auto:reliable`; a concrete model ID can be configured.
   Each SSE reply reports provider/model/route metadata for diagnostics.
4. **Offline fallback.** If no provider is configured, the gateway is
   unreachable, or the request fails, ECHO answers with reviewed deterministic
   portal guidance. A provider error never produces a fabricated model reply.
5. **Optional speech.** The widget uses the browser's free on-device
   `speechSynthesis` by default. On/off, Stop, 0.8-1.5x speed, sentence
   streaming, non-overlapping playback and session-scoped settings are provided.
   Text still works if speech fails. A replacement can be registered with
   `window.EchoWidgetSpeechProviders`; no key or paid TTS is required.
6. **Paid providers are opt-in only.** `OPENAI_API_KEY` is ignored unless
   `ECHO_ALLOW_PAID_PROVIDER=true`. FreeLLMAPI always wins when configured.

## Configure

Environment variables are read by the server. Never put provider keys in the
widget or any `VITE_*` variable. The repository does not auto-load `.env` files;
set variables in the process or hosting platform.

```text
FREELLMAPI_BASE_URL=https://your-public-gateway.example.com/v1
FREELLMAPI_API_KEY=<server-only secret>
FREELLMAPI_MODEL=auto:reliable
ECHO_ALLOW_PAID_PROVIDER=false
ECHO_SESSION_SECRET=<long random production value>
```

- **Local development:** with `FREELLMAPI_API_KEY` set and no base URL, ECHO
  uses `http://127.0.0.1:31415/v1` when `NODE_ENV` is not `production`. Start
  the FreeLLMAPI desktop app first.
- **Production:** non-loopback endpoints must be HTTPS, with no credentials in
  the URL and no query string. Loopback and plain HTTP are rejected.
- `FREELMAPI_*` and `ECHO_MODEL_*` remain accepted as legacy aliases.
- `ECHO_SESSION_SECRET` (or the portal `SESSION_SECRET`) is required for
  sessions to survive restarts and multiple serverless instances. Without it a
  random per-process key is used.
- An external ECHO service can be selected with `ECHO_API_URL`; it must be HTTPS
  in production and configured with its own provider. Cross-origin requests do
  not send portal cookies.
- `ECHO_CHAT_ENABLED=false` hides the assistant.

### Vercel limitation

Vercel cannot reach a gateway running on your PC at `127.0.0.1:31415`. Production
FreeLLMAPI therefore needs a public HTTPS endpoint reachable from Vercel, plus
the three `FREELLMAPI_*` variables in **Project Settings -> Environment
Variables**. Until those exist, the deployed assistant is intentionally limited
to deterministic guidance. The browser never receives the endpoint key.

## Diagnostics

`GET /api/echo/provider` requires portal authentication and returns only:
provider id, primary (`freellmapi`), configured, model, base host, paid-provider
flag, last usage metadata, reachability and probe HTTP status. It never returns
keys, prompts or replies. A model-backed SSE reply includes an `event: meta`
frame with provider, model and upstream route.

## What is not sent to the model

No school database records, marks, attendance, messages, profiles or portal
actions are supplied automatically. Only the typed message, the current page
route and short in-memory conversation history are sent. Users can still type
personal information, so review provider data handling before launch.

## Checks

```powershell
npm run test:echo
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:echo:browser
```

The browser check uses the built `dist/` output, a disposable portal database
and a fake SSE transport; it covers login, commands, conversation UI, speech
controls, fallback, mobile layout, logout cleanup and account isolation. Rebuild
before running it after client changes.

The opt-in real-provider check starts the actual server, uses the local
FreeLLMAPI gateway, verifies a multi-turn synthetic code recall, provider
metadata and the live browser reply. It reads `FREELLMAPI_*` from the
environment, or from the FreeLLMAPI desktop database only when
`ECHO_USE_DESKTOP_SETTINGS=true`. It never prints the key.

```powershell
$env:ECHO_USE_DESKTOP_SETTINGS='true'
npm run test:echo:provider
```

## Known residual risks

- History and revocation are process-local, so serverless instances do not share
  them. Sessions remain signed and account-bound, but remote context can reset
  between instances.
- The portal's cookie signing secret still has a shipped default when
  `SESSION_SECRET` is unset. Set a private value in production; ECHO's own
  fallback is random, but the portal login cookie is the outer gate.
- Reflected CORS is pre-existing portal-wide behavior; ECHO origin checks add a
  second gate but do not fix the whole API.
- Stop aborts the browser request and discards the token, but cannot guarantee
  upstream cancellation or billing behavior.
- The browser test uses a fake provider; only the opt-in provider test proves a
  live model.

Release verification is in `docs/RELEASE_VERIFICATION.md`; pending deployment
work is in `docs/PENDING_WORK.md`.
