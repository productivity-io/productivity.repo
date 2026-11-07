# Pending work and gates

- Four selected features are implemented and verified. No unfinished selected implementation remains.
- Live provider round trip requires an operator-configured provider. Fake browser SSE is not provider evidence.
- Existing built-in backend has a hard-coded fallback signing secret, public session endpoints, permissive reflected CORS, unbounded process-local stores and no account-bound session identity. Keep knowledge public; review these before production/private data. This task does not change permissions or supply private records.
- Process-local history/revocation is not durable across serverless instances. Review hosting architecture separately.
- Integration README now describes built-in and external modes and the new controls. Root README reflects the prior hosting update.
- No merge/deployment authorized. Source ECHO uncommitted work must remain untouched.
- No live provider call was made; built-in static guidance and fake SSE have separate test evidence.
- Action confirmation verifies router URL/year state; it does not prove lazy-page data fetching succeeded.
- Stop discards the remote token; abandoned server sessions expire rather than being guaranteed deleted immediately. It does not guarantee upstream billing cancellation. Refresh deliberately clears memory-only chat history.
- Multi-browser/mobile-device coverage and deployment-specific smoke tests remain release tasks. Chrome mobile viewport was tested, not a physical phone.
