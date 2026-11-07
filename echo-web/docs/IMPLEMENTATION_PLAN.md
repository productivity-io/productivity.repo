# Implementation plan

1. Record baseline and save master handoff before coding. Preserve ECHO dirty tree.
2. Add role-aware local help/context derived only from the existing route/control registry. Show suggestions without model calls or DOM scraping.
3. Resolve action replies only after router/year state is observed; time out honestly. Keep input busy to prevent duplicate submission.
4. Add Stop using existing abort support; discard the stopped remote conversation token because external backends can commit at different times. Add explicit copy controls for completed messages, with clipboard failure feedback.
5. Extend command tests and real-browser tests; run TypeScript, production build, widget syntax and whitespace checks. Use temporary demo DB only.
6. Update evidence and both master handoffs; prepare a dedicated commit and PR summary. Do not merge or deploy.

Tests must distinguish fake SSE transport checks, real built-in help-engine tests, and unavailable live-provider validation.

## User-requested typo-recognition phase - complete

Inspect/preserve baseline -> local feature branch -> registry-based bounded fuzzy ranking -> confirmation lifecycle -> authenticated existing subject options -> atomic plans -> regressions and real browser view verification -> updated handoffs and local commits. No new provider calls/dependencies, push, merge or deployment in this phase. See FUZZY_COMMANDS.md and the implementation log for final evidence.
