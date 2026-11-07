# Pending work and gates

- Latest phase: intelligent typo recognition is complete on local `feature/echo-fuzzy-commands`, implementation `0445f91`. Local 87-test suite, TypeScript/build/browser checks PASS. See FUZZY_COMMANDS.md. New branch not pushed; no new PR or merge/deployment. Prior PR #2 remains a separate blocked parent-branch review. Latest user instruction requires approval before merging/deploying.

- Four selected features are implemented and verified. No unfinished selected implementation remains.
- Real-provider round trip now PASS for the supported external ECHO mode using the user-approved existing FreeLLMAPI-configured gateway; see RELEASE_VERIFICATION.md. Built-in OpenAI path remains untested against a real provider.
- Existing built-in backend has a hard-coded fallback signing secret, public session endpoints, permissive reflected CORS, unbounded process-local stores and no account-bound session identity. Keep knowledge public; review these before production/private data. This task does not change permissions or supply private records.
- Process-local history/revocation is not durable across serverless instances. Review hosting architecture separately.
- Integration README now describes built-in and external modes and the new controls. Root README reflects the prior hosting update.
- User now authorizes merge only after all checks pass; security gates currently FAIL, so do not merge. No deployment authorized. Source ECHO uncommitted work must remain untouched.
- Actual provider smoke, built-in static guidance and fake-SSE browser regression have separate test evidence.
- Action confirmation verifies router URL/year state; it does not prove lazy-page data fetching succeeded.
- Stop discards the remote token; abandoned server sessions expire rather than being guaranteed deleted immediately. It does not guarantee upstream billing cancellation. Refresh deliberately clears memory-only chat history.
- Multi-browser/mobile-device coverage and deployment-specific smoke tests remain release tasks. Chrome mobile viewport was tested, not a physical phone.
- Release audit reproduces six security failures: anonymous issuance, unapproved origin acceptance, usable default-secret forgery, malformed expiry, ignored token suffix and unsupported body fields. Three existing protections pass. CI includes a failing security gate so these cannot be mistaken for a green release; no branch-protection settings changed.
