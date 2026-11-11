# ECHO backend / frontend integration contract

Status: backend branch `feature/echo-durable-integration`, ready for review.
No merge until the integration suite passes on the merged tree.

## Ownership boundary

| Area | Owner | Notes |
|---|---|---|
| `src/**` components, pages, CSS, routes | Frontend | Backend does not modify these files |
| `echo-web/widget/**` | Frontend (behaviour contract frozen by backend tests) | Untouched by this branch |
| `server/**`, `tests/**` | Backend | This branch's changes |
| `package.json` scripts | Shared | Coordinate before editing the same line |
| `echo-web/docs/**` | Backend | Handoff, report and this contract |

## Backend commits already on `main`

`c33ee53` (durable ECHO state, private uploads, DB path, backup tool) and
`9607604` (documentation) were pushed to `main` before the branch policy took
effect. They are not reverted; this branch starts from that state and adds only
integration documentation and the integrated test runner. No coworker commit
existed at the last fetch (local and remote were identical).

## Interfaces the frontend can rely on

All of these are unchanged in shape:

- `GET /api/echo/config` -> `{ enabled, siteId, apiBaseUrl }`
- `POST /api/echo/v1/sites/:siteId/sessions` -> `201 { session_token, expires_in }`
- `DELETE /api/echo/v1/sites/:siteId/sessions/current` -> `{}`
- `POST /api/echo/v1/sites/:siteId/messages` (SSE) -> `meta`, `delta`, `done`, `error`
  - `done` payload: `{ references, action?, records? }`
  - `action` payload: `{ type: 'navigate', actionId, path, label }`
  - `records` render as text-only cards
- `GET /api/echo/provider` -> authenticated diagnostics (never the key)
- Portal auth, roles and record scoping endpoints: untouched.

## The one behaviour change: `/uploads/*`

- URL shape is identical (`/uploads/:folder/:name`), so stored URLs in the database
  and existing links keep working.
- Reads now require a valid portal session and pass one of:
  - the uploader reads their own file;
  - staff (`teacher`, `coordinator`, `principal`) read any file;
  - any signed-in user reads a file linked from an announcement, assignment or
    submission.
- Anonymous requests get `401`; other students get `403` for unreferenced files;
  invalid paths get `400`/`404`.
- Frontend requirement: fetch uploads in a credential-carrying context
  (`<a href>` navigation or same-origin `fetch` with cookies). Do not proxy
  `/uploads` through a third-party origin, and do not open them in a context that
  drops cookies. Cross-origin CORS rules are unchanged and still reject unknown
  origins.

## Merge discipline

1. `git fetch origin` before every merge; inspect `git log origin/main` first.
2. Never force-push, revert or rewrite a coworker's commit.
3. Do not resolve an unfamiliar conflict by choosing one side. Conflicts in
   `src/**` are decided by the frontend owner; `server/**` by the backend owner;
   shared `package.json` changes are coordinated.
4. Rebase only your own feature branch, never `main`.
5. If the frontend redesign changes an ECHO-facing contract, update this file and
   the handoff before merging.

## Verification

```bash
npm run test:integration
```

Runs, in order: `tsc --noEmit`; 204 unit/integration tests; the upload access
test (401/403/200/200, traversal, restart persistence); the production build; the
ECHO browser regression; the tool-routing browser regression.

## Pull request checklist

- [x] Branch is not `main` and is pushed.
- [x] No `src/**`, CSS, route or widget file modified.
- [x] API and SSE contracts unchanged; `/uploads` auth change documented above.
- [x] TypeScript, unit, upload, build and browser suites pass on the branch.
- [x] `origin/main` fetched and compared; no coworker commits overwritten.
- [ ] Reviewer approval.
- [ ] Re-run `npm run test:integration` on the merged result before merging.
- [ ] Production deployment with durable storage and a reachable HTTPS provider
      (still blocked: no hosted database or volume, no deployed SHA).

## Known limitations carried into the redesign

- ECHO history and working memory are durable only where the database file lives on
  persistent storage.
- Uploads are durable only where `VERITAS_UPLOAD_DIR` is persistent; no
  object-store driver yet.
- The provider gateway is still laptop-dependent; without a reachable HTTPS gateway
  ECHO answers with deterministic guidance and never claims a model answered.
