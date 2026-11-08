# Pending work and gates

Updated: 2026-11-08.

- FreeLLMAPI is implemented and verified as ECHO's primary conversational provider. Security gates now pass 12/12; 129 unit tests, TypeScript, production build, full browser regression and the opt-in live-provider test pass locally.
- Built-in `/api/echo` now requires portal identity, binds sessions to the account `sub`, rejects unapproved origins, has no public fallback signing secret, validates token expiry/format strictly, allowlists body fields and bounds/rate-limits state.
- Production Vercel currently has no reachable conversational provider. The deployed old build answered a model-only prompt with its scripted fallback. Vercel cannot reach the PC loopback gateway at `127.0.0.1:31415`; set a public HTTPS `FREELLMAPI_BASE_URL`, `FREELLMAPI_API_KEY` and `FREELLMAPI_MODEL` in Vercel project settings, then redeploy. Do not expose these to the frontend.
- Set a private `SESSION_SECRET` in Vercel. The portal cookie code still ships a public default secret; ECHO's own fallback is random, but the portal session is the outer gate.
- Remaining limitations: process-local history/revocation across serverless instances; reflected portal-wide CORS; Stop cannot guarantee upstream cancellation/billing; action confirmation verifies route state, not lazy data loading; browser regression uses fake SSE, only the opt-in provider test proves a live model; no physical-device or multi-browser matrix yet.
- Deployment must be re-verified after push: confirm the Vercel build, sign in, check `/api/echo/provider`, and run a model-only prompt to confirm provider metadata. An HTTP 200 or Ready status alone is not provider proof.
- No paid provider is enabled. OpenAI remains ignored unless `ECHO_ALLOW_PAID_PROVIDER=true`.
