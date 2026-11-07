# Add contextual ECHO help, confirmed portal actions and response controls

Users can discover page-specific commands, inspect current view filters locally, stop a response and copy completed assistant messages. Portal actions now confirm matching router/browser URL or year-selector state before replying; unconfirmed changes report failure.

Reuses the existing command registry, role checks, widget lifecycle and backend integration. No new dependencies, voice features, school-record writes, persistent transcript storage or private-page data sent to a provider. Source ECHO's dirty worktree and desktop/Android code are untouched.

Validation: 66 command/config tests; TypeScript; production build; Chrome browser regression with a disposable DB (attendance typo/navigation, filters, help/suggestions, action success/failure, copy success/denial, Stop/reset, error recovery, mobile viewport, logout and account isolation); real built-in static help HTTP session/reset checks; 7 source headless-backend tests; widget syntax and diff whitespace. External SSE is a fixture, not live provider verification.

Release verification: branch pushed, PR #2 open. Actual external ECHO/provider browser smoke passed using the user-approved existing gateway. Quality CI passed; security CI failed six baseline requirements. See RELEASE_VERIFICATION.md. Merge is authorized only after every check passes; currently blocked. Deployment is not authorized.

Limits: confirmation covers view state, not data-loading success. Stop cannot guarantee provider cancellation/billing. Built-in session/hosting requirements need remediation before merge. Built-in OpenAI-only provider path remains distinct from the verified external mode.
