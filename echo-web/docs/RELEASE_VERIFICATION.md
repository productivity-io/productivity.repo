# Release verification - 2026-11-07

PR: https://github.com/productivity-io/productivity.repo/pull/2

Branch: `feature/echo-context-and-controls`. Implementation: `15f2410d54748d7c6cd0f7d41c9947f6d9aee245`; initial handoff: `eb69a8274d6281898d69bdbf1b7c01e95f8eff65`; release checks: `94b5231e7bcf142e5662182abec24a7e187e3d09`.

The user authorized pushing, PR creation, review, CI, real-provider testing and merge only after all checks pass. Public deployment was not authorized. The branch was pushed and PR #2 opened through Git's existing GitHub credential after the connector returned HTTP 403. No credentials were printed or committed.

## Real-provider evidence - PASS for external ECHO mode

The user approved using the existing FreeLLMAPI configuration. The source desktop settings select a loopback compatible gateway on port 31415. Only the Python backend read the existing encrypted provider key; it was not sent to OpenAI, the browser or GitHub. No new key or provider configuration was written. No desktop/audio services were started.

1. Existing source `echo-web/tests/live_smoke.py`: PASS, two real HTTP 200 turns, 22 and 10 delta events, 83 and 41 response characters, four history messages. Durations 1.031 and 0.625 seconds.
2. New target `tests/echo-provider-smoke.mjs`: PASS, actual Veritas login/widget -> actual Python ECHO API -> configured gateway -> streamed provider answer. A random synthetic code was recalled on the second turn; replies are not logged. Both turns returned HTTP 200 with ten deltas, 45 displayed characters and durations 997ms/283ms. Existing typo-tolerant attendance navigation then succeeded with verified state feedback.

There are no mocked engines or responses in these provider checks. Source gateway upstream internals were not audited; evidence is for the configured real gateway and ECHO API. This does not establish the built-in TypeScript OpenAI-only path, HTTPS hosting or production deployment readiness. Ordinary regression browser tests still deliberately use fake transport.

Reproduce locally (PowerShell, no keys in command text):

```powershell
$env:ECHO_SOURCE_ROOT='F:\Downloads\Echo-Web-Preparation'
$env:ECHO_USE_DESKTOP_SETTINGS='true'
node tests/echo-provider-smoke.mjs
```

Alternatively set `ECHO_MODEL_BASE_URL` and `ECHO_MODEL_API_KEY` in the backend process environment without opting into desktop settings. Do not pass a FreeLLMAPI key to an OpenAI endpoint. The fixture uses synthetic public content and a disposable portal database. All test services terminate afterward.

## Security audit - FAIL, merge blocked

Command: `node node_modules/tsx/dist/cli.mjs --test tests/echo-security.test.ts`.

The test imports the actual built-in router on an ephemeral loopback port with no provider key and no DB. It tests the missing-secret baseline intentionally; generated tokens and responses are not printed. Result: **3 pass, 6 fail**.

| Requirement | Observed | Result / evidence |
| --- | --- | --- |
| Account-gated session issuance | Anonymous POST returns 201 | FAIL; `server/index.ts:95`, `server/services/echo.ts:387` |
| Unapproved origins rejected | Unapproved Origin receives 200 and is reflected | FAIL; `server/services/echo.ts:342` |
| No usable public fallback signing secret | Synthetic unissued token signed with shipped default receives 200 | FAIL; `server/services/echo.ts:95`, `:430` |
| Strict expiry payload validation | Non-numeric signed expiry receives 200 | FAIL; `server/services/echo.ts:123` |
| Strict token format | Valid token plus an extra suffix receives 200 | FAIL; `server/services/echo.ts:116` |
| Reject unsupported request/tool fields | Message plus tools field receives 200 (field is ignored, not executed) | FAIL; `server/services/echo.ts:424` |
| Invalid signatures rejected | 401 | PASS |
| Expired tokens rejected | 401 | PASS |
| Same-process reset revokes token | Subsequent request is 401 | PASS |

These are pre-existing built-in engine issues, not introduced by the four widget features. Static review additionally confirms process-local unbounded history/revocation stores, no account binding/logout invalidation, no rate/capacity limits, and no durable multi-instance revocation. Confirming public-help isolation is not sufficient to pass these school deployment gates. No private school record exposure was observed or tested against real data.

## Code review

Reviewed the feature diff and current backend implementation. The four feature additions preserve the role allowlist, safe text rendering, local command routing, memory-only state and account widget teardown. No privileged tools, record writes, dependencies or browser API keys were added. Router confirmation is intentionally limited to state rather than page-data readiness. Stop discards remote context and cannot guarantee upstream billing cancellation.

Release blockers above require an authenticated session design and backend hardening; no website permissions were changed in this verification task. The built-in provider path also silently falls back to static help on provider errors, so a Ready status alone must never be accepted as provider proof. The real-provider test uses the source API path that reports streaming failure rather than static fallback.

Local parallel TypeScript/provider test attempts exhausted the workstation's available memory. The provider test was rerun sequentially with Node 22 and bounded heaps and passed. Full quality checks run on the GitHub runner; an OOM is not a passing TypeScript result.

## CI and merge decision

No Actions workflow/checks existed at the original PR head. Added `.github/workflows/echo-checks.yml`: quality job runs command tests, TypeScript, widget syntax, build and browser regression; separate session-security job runs the actual release requirements without suppressing failures. No repository branch-protection or permission settings were changed. Real-provider smoke is local opt-in because the approved gateway is loopback-only and its key is not configured on GitHub.

GitHub PR-triggered run: https://github.com/productivity-io/productivity.repo/actions/runs/42366552606

- `quality`: PASS, job 128385718936. npm ci, 66 tests, TypeScript, widget syntax, build, browser regression and artifact upload succeeded.
- `session-security`: FAIL, job 128385718831. Dependency install succeeded; actual release requirements failed. Local reproduction: 3 pass / 6 fail.

Security failures block merging even though quality passes. Do not enable auto-merge or skip failed tests. No merge/deployment performed. Documentation follow-ups rerun CI; inspect the final PR head.
