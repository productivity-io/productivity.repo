# Productivity portal

Veritas school-management application built with React, Vite, Express and SQLite.

Use Node 22 LTS for the existing native SQLite dependency.

```sh
npm ci
npm run dev
```

The Vite frontend runs on port 5173 and proxies API requests to the Express backend on port 3001.
The existing server seeds a local demonstration database at startup when it is empty.

## ECHO assistant

ECHO website chat is integrated for signed-in users. Configure an ECHO service and enable it through the
Express process environment. It is disabled by default until those settings are provided.

See [ECHO setup, architecture and rollout](echo-web/README.md) and [validation results](echo-web/VALIDATION.md).
Provider keys belong on the ECHO service; the portal receives only its public site ID and API origin.

```sh
npm run test:echo
npm run build
npm run test:echo:browser
```
