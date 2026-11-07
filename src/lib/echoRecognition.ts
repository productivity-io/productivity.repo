/** Bounded local matching against real read-only actions; no model-generated URLs or tools. */
import { ECHO_PAGES, ECHO_VIEWS, allowed, normalize, normalizePageTerm, resolvePortalCommand } from './echoCommands';
import type { CommandContext, PortalCommand } from './echoCommands';

export type Choice = { label: string; message: string };
export type Recognition = { confidence: 'high' | 'medium' | 'low'; score: number; action?: PortalCommand; choices?: Choice[]; reply?: string };
type Candidate = Choice & { action: PortalCommand; score: number };
export const COMMAND_THRESHOLDS = { high: 0.82, medium: 0.62, margin: 0.12 } as const;

/** Optimal-string-alignment distance, including adjacent transposition (shwo -> show). */
export function editDistance(a: string, b: string): number {
  if (a.length > 80 || b.length > 80) return Math.max(a.length, b.length);
  const grid = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) grid[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
  }
  return grid[a.length][b.length];
}
const ABBREVIATIONS: Record<string, string> = { att: 'attendance', attn: 'attendance', dash: 'dashboard', db: 'dashboard', cal: 'calendar', lib: 'library', hw: 'assignments', tt: 'timetable', msgs: 'communication' };
const VERB_TYPOS: Record<string, string> = { opem: 'open', shiw: 'show' };
const similarity = (a: string, b: string) => a === b ? 1 : Math.min(a.length, b.length) < 4 ? 0 : 1 - editDistance(a, b) / Math.max(a.length, b.length);
const tidy = (text: string) => normalize(text).replace(/^(?:the |my )/, '').replace(/\s+(?:right now|for me|please)$/, '').trim();

function ranked(candidates: Candidate[]): Recognition | null {
  const unique = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = c.action.href || c.action.reply;
    if (!unique.has(key) || unique.get(key)!.score < c.score) unique.set(key, c);
  }
  const list = [...unique.values()].sort((a, b) => b.score - a.score);
  const best = list[0];
  if (!best || best.score < COMMAND_THRESHOLDS.medium) return null;
  const gap = best.score - (list[1]?.score || 0);
  if (best.score >= COMMAND_THRESHOLDS.high && gap >= COMMAND_THRESHOLDS.margin) return { confidence: 'high', score: best.score, action: best.action };
  // Restricted pages never become confirmation options, even on a near match.
  const choices = list.filter(c => c.action.href && c.score >= Math.max(COMMAND_THRESHOLDS.medium, best.score - COMMAND_THRESHOLDS.margin)).slice(0, 3)
    .map(({ label, message }) => ({ label, message }));
  return choices.length ? { confidence: 'medium', score: best.score, choices,
    reply: 'Did you mean ' + choices.map((c, i) => `${i + 1}: ${c.label}`).join(' or ') + '? Reply ' + (choices.length === 1 ? 'yes' : 'with a number') + ' to confirm, or no to cancel.' }
    : { confidence: 'low', score: best.score, reply: 'That page is not available for your portal role.' };
}

export function recognizePortalCommand(message: string, context: CommandContext): Recognition | null {
  if (typeof message !== 'string' || message.length > 4000) return null;
  const original = message.trim().replace(/^echo[,!\s]+/i, '').replace(/^please\s+/i, '').replace(/[.!?]+$/, '').replace(/[, ]+please$/i, '');
  if (!original) return null;
  let text = normalize(original);
  // Searches are already safe registered actions; preserve their payload verbatim, even keywords/quotes.
  if (/^(?:search|find|look)\b/.test(text)) {
    const search = resolvePortalCommand(original, context);
    return search ? { confidence: 'high', score: 1, action: search } : null;
  }
  // Questions, negations, hypotheticals and quoted instructions do not acquire command intent.
  if (/^(?:what|why|how|where|when|who|explain|tell|describe|say|discuss|do you|i think|i like)\b/.test(text)) {
    const exact = resolvePortalCommand(original, context);
    return exact && !exact.href && !exact.academicYear ? { confidence: 'high', score: 1, action: exact } : null;
  }
  if (/\b(?:not|never|don't|dont|instead|if|maybe)\b|["“”`]|https?:|javascript:|\/\//.test(text)) return null;
  // Never reinterpret mutations as read-only navigation; exact year selection remains supported.
  const exact = resolvePortalCommand(original, context);
  if (exact?.academicYear || exact?.href || exact?.back) return { confidence: 'high', score: 1, action: exact };
  if (exact && /^(?:switch|change|select|set).*\byear\b/.test(text)) return { confidence: 'high', score: 1, action: exact };
  if (/\b(?:delete|remove|submit|save|approve|decline|send|create|update|change|mark|pay|upload|download)\b/.test(text)) return null;

  if (/\s+or\s+/.test(text)) {
    const alternatives = original.split(/\s+or\s+/i);
    const choices: Choice[] = [];
    if (alternatives.length > 3) return { confidence: 'low', score: 0, reply: 'Please name one supported page.' };
    for (const part of alternatives) {
      const result = recognizePortalCommand(part, context);
      if (!result?.action?.href || result.confidence !== 'high') return { confidence: 'low', score: 0, reply: 'Please name one supported page. Nothing was changed.' };
      choices.push({ label: part, message: part });
    }
    return { confidence: 'medium', score: 0.75, choices, reply: 'Which did you mean? ' + choices.map((c, i) => `${i + 1}: ${c.label}`).join('; ') + '. Reply with a number, or no to cancel.' };
  }
  // An atomic navigation + view plan produces one final URL, never partial execution.
  if (/\s+(?:and then|then|and)\s+/.test(text) && !/lost and found|students and faculty/.test(text)) {
    const parts = original.split(/\s+(?:and then|then|and)\s+/i);
    if (parts.length > 3) return { confidence: 'low', score: 0, reply: 'Use at most three supported view commands at a time.' };
    let state = context;
    let final: PortalCommand | undefined;
    let confidence: Recognition['confidence'] = 'high';
    const canonical: string[] = [];
    for (const part of parts) {
      const result = recognizePortalCommand(part, state);
      const choice = result?.confidence === 'medium' && result.choices?.length === 1 ? result.choices[0] : undefined;
      const action = choice ? recognizePortalCommand(choice.message, state)?.action : result?.action;
      if (!action?.href || (final && new URL(final.href!, 'https://portal.invalid').pathname !== new URL(action.href, 'https://portal.invalid').pathname))
        return { confidence: 'low', score: 0, reply: 'I could not match every part to one supported page and its view controls. Nothing was changed. Try one command at a time.' };
      if (choice) { confidence = 'medium'; canonical.push(choice.message); } else canonical.push(part);
      final = action;
      const url = new URL(action.href, 'https://portal.invalid');
      state = { ...state, path: url.pathname, search: url.search };
    }
    if (confidence === 'medium') return { confidence, score: 0.75, choices: [{ label: canonical.join(' then '), message: canonical.join(' then ') }], reply: 'Did you mean this combined view command? Reply yes to confirm or no to cancel.' };
    return { confidence, score: 1, action: final };
  }

  if (exact && /^(?:help|where am i|what page am i on)\b/.test(text))
    return { confidence: 'high', score: 1, action: exact };
  if (text.length > 180 || text.split(' ').length > 20) return null;
  text = text.replace(/^(?:can|could|would) you(?: please)? /, '')
    .replace(/^i (?:want|wanna|wana|would like|need)(?: to)? (?:see|view|open|check|get to) /, 'show ');
  const tokens = text.split(' ');
  const prefix = tokens[0];
  const verb = ['open', 'show', 'take', 'go', 'view', 'navigate', 'filter', 'select', 'switch'].find(v => v === tokens[0]
    || VERB_TYPOS[prefix] === v
    || (prefix.length >= 3 && v.length >= 3 && prefix !== v + 's' && editDistance(prefix, v) <= 1
      && (prefix.length !== v.length || [...prefix].sort().join('') === [...v].sort().join(''))));
  const hasIntent = Boolean(verb);
  const explicitVerb = verb === prefix;
  if (verb) {
    tokens.shift();
    text = tokens.join(' ').replace(/^(?:me\s+)?(?:to\s+)?/, '').replace(/^(?:the|my)\s+/, '').replace(/^only\s+/, '');
  }
  text = tidy(text).replace(/\s+(?:only|tab|view)$/, '');
  if (!text || /\b(?:is|are|was|does|because|should|would|could|can|why|how|policy|rules)\b/.test(text)) return null;
  const term = ABBREVIATIONS[text] || normalizePageTerm(text);
  const candidates: Candidate[] = [];
  // Filter-only intent and "only" must never silently become plain navigation.
  const filterOnly = verb === 'filter' || verb === 'select' || /\bonly\b/.test(normalize(original));
  if (!filterOnly) for (const page of ECHO_PAGES) {
    const pageSimilarity = (name: string) => {
      const target = normalizePageTerm(name);
      const words = term.split(' ');
      const targetWords = target.split(' ');
      if (!hasIntent && (words.length !== targetWords.length || words.some((word, i) => similarity(word, targetWords[i]) < 0.75))) return 0;
      return similarity(term, target);
    };
    const score = Math.max(...page.aliases.map(pageSimilarity), pageSimilarity(page.label));
    const action = resolvePortalCommand('Open ' + page.aliases[0], context)!;
    candidates.push({ score: hasIntent || score === 1 ? score : Math.min(score, COMMAND_THRESHOLDS.high - 0.01), action, label: 'Open ' + page.label, message: 'Open ' + page.aliases[0] });
  }
  if (hasIntent) for (const page of ECHO_PAGES) {
    if (!allowed(page, context.role)) continue;
    for (const [field, rule] of Object.entries(ECHO_VIEWS[page.path] || {})) {
      if ((page.path === '/attendance' || (page.path === '/assignments' && field === 'status')) && context.role !== 'student') continue;
      const names: [string, string][] = [...(rule.values || []).map(value => [normalize(value), value] as [string, string]), ...Object.entries(rule.aliases || {})];
      for (const [name] of names) {
        const canonical = `Show ${name} ${page.aliases[0]}`;
        const action = resolvePortalCommand(canonical, context);
        if (!action?.href) continue;
        const options = page.aliases.map(alias => `${name} ${alias}`);
        if (page.path === context.path) options.push(name);
        const score = Math.max(...options.map(option => similarity(text, option)));
        candidates.push({ score, action, label: `Show ${name} in ${page.label}`, message: canonical });
      }
    }
  }
  // Only the real, loaded Assignments subject controls are eligible. IDs never come from fuzzy text.
  if (hasIntent && context.path === '/assignments') for (const subject of context.subjects || []) {
    const names = [subject.label, ...(subject.aliases || [])].map(normalize).flatMap(name => [name, `${name} assignments`, `${name} homework`]);
    const score = Math.max(...names.map(name => similarity(text, name)));
    const params = new URLSearchParams(context.search);
    params.set('echo_subject', subject.value);
    candidates.push({ score, action: { href: '/assignments?' + params, reply: `Applying ${subject.label} subject filter in Assignments.` }, label: `Show ${subject.label} assignments`, message: 'Show only ' + subject.label });
  }
  const result = ranked(candidates);
  if (result) return result;
  if (explicitVerb || exact) return { confidence: 'low', score: 0, reply: 'I could not match that to an available page or filter. Nothing was changed. Try “Help with this page” or name one portal page.' };
  return null;
}

/** One pending local confirmation, bound to current role/view/options and a 60-second lifetime. */
export class EchoCommandSession {
  private pending?: { choices: Choice[]; scope: string; at: number };
  constructor(private readonly now = () => Date.now()) {}
  reset() { this.pending = undefined; }
  resolve(message: string, context: CommandContext & { academicYear?: string }): Recognition | null {
    const scope = JSON.stringify([context.path, context.search, context.role, context.academicYear, context.academicYears, context.subjects]);
    const text = normalize(message).replace(/[.!?]+$/, '');
    const pending = this.pending;
    if (pending) {
      const confirmation = /^(?:yes|yep|confirm|(?:confirm )?[1-3])$/.test(text);
      if (/^(?:no|nope|cancel|never mind)$/.test(text)) { this.reset(); return { confidence: 'low', score: 0, reply: 'Command cancelled. Nothing was changed.' }; }
      if (confirmation) {
        if (pending.scope !== scope || this.now() - pending.at > 60000) {
          this.reset();
          return { confidence: 'low', score: 0, reply: 'That confirmation expired or the portal view changed. Please repeat the command.' };
        }
        const index = /[1-3]$/.test(text) ? Number(text.at(-1)) - 1 : pending.choices.length === 1 ? 0 : -1;
        const choice = pending.choices[index];
        if (!choice) return { confidence: 'medium', score: 0.75, choices: pending.choices, reply: 'Please choose a listed number, or no to cancel.' };
        this.reset();
        const result = recognizePortalCommand(choice.message, context);
        return result?.confidence === 'high' && result.action?.href ? result : { confidence: 'low', score: 0, reply: 'That command is no longer available. Please repeat it.' };
      }
    }
    this.reset();
    const result = recognizePortalCommand(message, context);
    if (result?.confidence === 'medium' && result.choices) this.pending = { choices: result.choices, scope, at: this.now() };
    return result;
  }
}
