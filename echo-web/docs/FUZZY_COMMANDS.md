# Local typo-tolerant command recognition

Branch: `feature/echo-fuzzy-commands`, based on `67d238ffb52aa526a8db57957af3ea78abe37e1d`. Prior features/commits preserved. No new dependency, AI call, voice feature, backend permission or record write.

## Registered commands and aliases

Navigation targets remain ECHO_PAGES: Dashboard, Announcements, Attendance, Timetable, Assignments, Examinations, Portfolio, Transport, Contacts, Lost & Found, Leave Requests, Calendar, Library, Communication, Directory, Students, Staff, Reports, Settings and Profile. Existing staff-only restrictions apply to Directory/Students/Staff/Reports. `marks` and `grades` refer to the actual Examinations route (default Results view); no Grades route was created.

Existing ECHO_VIEWS defines valid tabs, days, categories, statuses and searches. Examples: subject/daily attendance, report card, Monday timetable, sports events, unread announcements, overdue assignments, issue history, Clear filters and Go back. Exact year changes remain supported only for real selector options; no fuzzy year changes.

Additional abbreviations: att/attn=Attendance; dash/db=Dashboard; cal=Calendar; lib=Library; hw=Assignments; tt=Timetable; msgs=Communication. Existing typo aliases and normalizePageTerm are reused.

Examples:

- `opn attendence`, `shwo attendnce`: Attendance.
- `tak me to dashbord`, `go calender`, `attendance`, `attn`: actual registered routes.
- `could you please opne the libary for me`: Library.
- `i wana see my marks`, `i want to check my grades`: Examinations Results.
- On Calendar: `shwo only sprts` applies the real sports category.
- On loaded Assignments: `shwo only maths`, `shwo maths only`, `show maths assignments` selects the real Mathematics subject ID and preserves status/unrelated URL values. Names/codes come only from the page's existing authenticated response. The current demo name is Advanced Mathematics, not an invented Mathematics entry. Multiple Mathematics options require confirmation.
- `opn calender then shwo sprts events`: one atomic final Calendar URL with the sports filter.
- `opn atendnce`: uncertain spelling, asks confirmation. `yes` executes; `no` cancels.
- `open calendar or timetable`: asks a numbered choice. `yes` alone cannot choose.

## Matching strategy and thresholds

The exact existing resolver runs first for registered actions, preserving literal search data and current controls. Unknown commands then pass conservative intent detection, explicit phrase/abbreviation normalization, and bounded optimal-string-alignment edit distance (insert/delete/substitute/adjacent transpose). Targets are generated from the actual page/view registry and available subject options, never model text or arbitrary URLs/selectors.

Score = 1 - edit distance / maximum string length. Existing exact aliases score 1. Short targets under four characters do not fuzzy match unless they are an explicit abbreviation. High confidence requires score >= 0.82 and a gap >= 0.12 from the next distinct action. Execute only safe registered navigation/view actions. Bare fuzzy fragments are capped below high confidence; bare exact page aliases remain supported. Medium requires score >= 0.62, or a too-close competitor. It produces at most three explicit choices with no action. Lower confidence makes no action and either preserves ordinary AI chat or asks clarification for an obvious unsupported command. Scores are heuristic similarities, not calibrated probabilities.

Only the leading command verb is corrected: one insertion/deletion or adjacent transposition, plus explicit keyboard substitutions `opem` and `shiw`. Arbitrary substitutions do not turn valid words such as slow/shop/cake into show/take. Unmatched guessed verbs fall back to chat. Bare fuzzy fragments require matching token counts and at least 0.75 similarity for every token, preventing unrelated multiword phrases from becoming page suggestions. Questions, negations, hypotheticals, quoted instructions, external URL intents and mutation verbs do not acquire fuzzy execution. Search payloads remain literal data, including names, spelling, quoted words and `and`; they are never split or corrected. Extra-word handling uses explicit polite/request wrappers, not unrestricted deletion of unknown words.

Fuzzy matching is limited to 180 characters/20 words, edit-distance strings to 80 characters, multi-part commands to three clauses, choices to three, and subject options to 100. Existing exact text/search limits remain 4000/200 characters. Ordinary commands stay local with no AI request.

## Confirmation and execution

One pending choice per widget instance, memory-only, valid for 60 seconds and bound to view/query, role, year and subject options. Confirm with yes/yep/confirm for a single option or 1/2/3 (optionally `confirm 1`). Multiple choices require a number. No/nope/cancel/never mind cancels. New chat, logout/account widget teardown and unrelated messages discard pending intent; changed context/expired confirmation is rejected. A selected canonical command is resolved again before execution.

Supported multi-part plans combine navigation and existing controls on a single destination. All clauses must validate before one final URL is applied; uncertain plans require whole-plan confirmation. Unsupported clauses or different destination pages execute nothing. Registered names containing `and` are protected. Search text remains one literal query. No database action is part of a plan.

The existing React action-confirmation system verifies router plus browser URL/year state before success feedback. Subject filter uses the existing Assignments buttons, now bound to validated URL selection; records and mutation forms are untouched. Options are account-scoped and removed on page cleanup. Invalid/unavailable subject IDs render All Subjects.

## Evidence and limits

Implementation commit: `0445f910b7fb5a8308965f1954556c62da5cb572`. Local only; no push, merge or deployment for this branch.

Current command/config suite: 87 PASS (all 66 baseline tests retained). TypeScript PASS. Production build PASS (2045 modules) after raising an initially-too-small 192 MB test heap; the failed heap-limited attempt is not a code failure. Widget syntax and diff whitespace PASS. React review covered effect cleanup, account scope, derived filter state and unchanged mutation forms.

Final Chrome browser regression PASS against the production build and disposable demo DB. Verified real router navigation for typos/abbreviations/alternate phrasing, actual sports button state, actual Mathematics assignment cards, preserved subject/status filters, actual Examinations Results table, medium confirmation and cancellation, numbered ambiguity, atomic combined commands, unsupported partial-plan rejection, role denial, stale confirmation on reset/away-and-back navigation, ordinary AI question forwarding, existing Stop/error/mobile/logout/account flows. Supported commands did not call the remote conversation service, and view changes made only GET portal requests. Transport is fake SSE; this is not a new real-provider test.

Development regressions were fixed before the final run: the marks-page assertion now waits for lazy data rendering, and ordinary words such as slow/shop/cake no longer become fuzzy imperative verbs. Added explicit normal-chat tests. There are no final failures in feature/unit/type/build/browser checks. Separately reran the unchanged security audit: 3 PASS / 6 FAIL, matching the prior release blockers; no backend/security files changed.

Commands: node node_modules/tsx/dist/cli.mjs --test tests/echo-config.test.ts tests/echo-commands.test.ts; node node_modules/typescript/bin/tsc --noEmit; node node_modules/vite/bin/vite.js build; node tests/echo-browser.mjs; node --check echo-web/widget/widget.js; git diff --check. Security audit: node node_modules/tsx/dist/cli.mjs --test tests/echo-security.test.ts. Local runs used existing Node 22 with bounded heaps, sequentially, to fit this workstation's memory. No dependency install.

No student attendance Mathematics selector exists. `show me my atendnce for maths` and `open attendance then show maths` therefore do not execute or claim a filter. Assignments must be loaded before its dynamic subjects can be matched. No automatic fetching, cross-page private context, persistent preference/history or subject-specific attendance feature is added. Arbitrary English paraphrases and every spelling error are not guaranteed. Voice remains excluded.

The prior built-in backend security release audit remains separate and blocking (six failures); this feature does not change authentication/session security or make PR #2 mergeable. Existing live-provider evidence is historical external-mode evidence, not re-established by fake browser SSE tests here.
