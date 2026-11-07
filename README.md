# Veritas Collegiate Academy — School Management Ecosystem

Full-stack School Management Application built with React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Express, Drizzle ORM, and Node.js built-in SQLite (`node:sqlite`), featuring the integrated **ECHO** portal assistant.

## Roles & Demo Accounts

All seeded demo accounts use password `password123`:

- **Student**: `student1` (`VCA-STU-1001`)
- **Teacher**: `teacher1` (`VCA-FAC-2001`)
- **Academic Coordinator**: `coordinator1` (`VCA-CRD-3001`)
- **Principal**: `principal` (`VCA-ADM-0001`)

## Local Development

Requires **Node.js 22.5+** (or Node 24 LTS). No native C++ addon compilation (`node-gyp`) is needed.

```sh
npm ci
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- Backend API (Express): `http://localhost:3001`

## ECHO Portal Assistant

Signed-in users get the **ECHO** floating assistant with two layers:

1. **Instant Read-Only Site Commands** (handled locally in the browser with typo tolerance and role-based access checks):
   - Navigation: `"Open attendance"`, `"open attendence portal"`, `"Open library"`, `"Go back"`, `"Where am I?"`
   - View & Tab Controls: `"Show unread announcements"`, `"Show sports events"`, `"Show Monday timetable"`, `"Show report card"`, `"Show issue history"`
   - Search & Academic Year: `"Search books for physics"`, `"Search students for Aarav"`, `"Switch academic year to 2025-2026"`, `"Clear filters"`
2. **Conversational Portal Help Engine**:
   - Works out-of-the-box via the built-in `/api/echo/v1/sites/productivity-portal` SSE service (no external server required).
   - Can optionally connect to a separate external ECHO server via `ECHO_API_URL=https://...` or use `OPENAI_API_KEY` on the server, or be disabled via `ECHO_CHAT_ENABLED=false`.

See [echo-web/README.md](echo-web/README.md) for architecture details.

## Deploying to Vercel

This repository is pre-configured for **zero-config Vercel deployment**:

- `vercel.json` builds the Vite frontend to `dist/` and routes `/api/*` and `/uploads/*` to the Express serverless function at `api/index.ts`, with SPA fallback routing to `/index.html`.
- On Vercel Serverless Functions (`process.env.VERCEL`), SQLite and file uploads automatically use `/tmp` (`os.tmpdir()`) and auto-seed the demonstration database on cold start without read-only filesystem (`EROFS`) errors.

## Verification

```sh
npx tsc --noEmit
npm run test:echo
npm run build
npm run test:echo:browser
```
