# Add contextual ECHO help, confirmed portal actions and response controls

Users can discover page-specific commands, inspect current view filters locally, stop a response and copy completed assistant messages. Portal actions now confirm matching router/browser URL or year-selector state before replying; unconfirmed changes report failure.

Reuses the existing command registry, role checks, widget lifecycle and backend integration. No new dependencies, voice features, school-record writes, persistent transcript storage or private-page data sent to a provider. Source ECHO's dirty worktree and desktop/Android code are untouched.

Validation: 66 command/config tests; TypeScript; production build; Chrome browser regression with a disposable DB (attendance typo/navigation, filters, help/suggestions, action success/failure, copy success/denial, Stop/reset, error recovery, mobile viewport, logout and account isolation); real built-in static help HTTP session/reset checks; 7 source headless-backend tests; widget syntax and diff whitespace. External SSE is a fixture, not live provider verification.

Limits: confirmation covers view state, not data-loading success. Stop resets remote conversation context and cannot guarantee provider cancellation/billing. Existing built-in session/hosting hardening and real provider checks remain documented production gates. Do not merge or deploy as part of this task.
