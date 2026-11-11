/**
 * Durable ECHO state wired to the application database.
 *
 * Kept separate so `echo.ts` stays testable with the in-memory store and does not import the
 * database itself.
 */
import { sqlite } from '../db/index.js';
import { createSqliteEchoStateStore } from './echoStateStore.js';

export const echoStateStore = createSqliteEchoStateStore(sqlite);
