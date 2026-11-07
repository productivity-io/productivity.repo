# ECHO integration inventory

Audit: 2026-11-07. Target baseline: `50f194969bc5042e6dfca3cd99460946c57a672d`.

Existing planning location: `echo-web/` (README and VALIDATION); these planning documents extend it in `echo-web/docs/`.

| Feature | Source evidence | Target status at audit |
| --- | --- | --- |
| Headless text engine, bounded history, streaming | ECHO `desktop/EchoDesktop/echo_desktop/backend.py`, `echo-web/core/engine.py` | External service supported; latest target also has an independent built-in TypeScript help engine with optional provider |
| Client-approved knowledge and isolated visitor tokens | ECHO `core/config.py`, `backend/sessions.py` | Built-in site/token sessions exist; private school records are not provided |
| Reset, safe text rendering, errors, responsive widget | Both `echo-web/widget/widget.js` files | Existing; current browser regression PASS |
| Portal navigation, typo aliases, URL filters, search, internal back | Target `src/lib/echoCommands.ts`, `useEchoViewState.ts`, `EchoAssistant.tsx` | Existing; current command/browser regression PASS |
| Logout abort and account-specific widget lifecycle | Target `EchoAssistant.tsx` | Existing; current browser regression PASS |
| Contextual help and page-specific suggestions | Existing target route/control registry reused | Added; command and browser tests PASS |
| Confirm actual router/year state after actions | Source confirmation principle; target router integration reused | Added; success, timeout and cancellation tested; confirms view state, not data loading |
| User-visible Stop and copy controls | Existing abort/text rendering reused | Added; browser stop/reset, clipboard success/failure PASS |
| Desktop encrypted memory, lists, shell/device actions | ECHO `storage.py`, desktop orchestrator | Deliberately excluded from school website |

Upstream ECHO working tree contains existing uncommitted changes. It is read-only for this task. Desktop/Android untouched.
