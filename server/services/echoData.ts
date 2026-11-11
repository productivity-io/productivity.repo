/**
 * Authorized, read-only application data for ECHO.
 *
 * Design rules, enforced here rather than in prompts:
 * - The caller supplies records only after the request has been authenticated by the host app.
 *   This module never touches a database, a session or a role claim.
 * - Only an explicit field allowlist leaves this module. Reporter ids, contact details, claim
 *   notes and verification notes never do, so no account's private data can reach a prompt, a
 *   log or another user's screen through a tool result.
 * - Record text is DATA. It is rendered by the server into a plain-text answer and structured
 *   cards; it is never interpreted as an instruction, a URL or a command, and it is never sent to
 *   a model provider. That is why the answers below are deterministic.
 * - Brand names in seed data may contain words like "found"; matching is on the user's message
 *   only, never on record content.
 */

export type EchoRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string[];
  status: string;
};

export type LostFoundItem = {
  id: number;
  type: string;
  itemName: string;
  category: string;
  location: string;
  dateReported: string;
  status: string;
  description: string;
};

export type LostFoundAnswer = {
  text: string;
  records: EchoRecord[];
  /** Sanitized items the next turn may refer to ("the second one", "that item"). */
  items: LostFoundItem[];
};

const MAX_ITEMS = 8;
const STATUS_TEXT: Record<string, string> = {
  reported: 'unclaimed',
  claim_pending: 'claim pending review',
  verified: 'verified, ready for collection',
  claimed: 'claimed and returned',
  archived: 'archived',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const text = (value: unknown, limit: number): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';

/** Field allowlist. Anything not named here is dropped before it can be displayed or remembered. */
export function shapeLostFoundItems(raw: unknown): LostFoundItem[] {
  if (!Array.isArray(raw)) return [];
  const shaped: LostFoundItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = Number(row.id);
    const itemName = text(row.itemName, 140);
    if (!Number.isInteger(id) || id <= 0 || !itemName) continue;
    shaped.push({
      id,
      type: text(row.type, 16) || 'found',
      itemName,
      category: text(row.category, 40),
      location: text(row.location, 90),
      dateReported: text(row.dateReported, 32),
      status: text(row.status, 24) || 'reported',
      description: text(row.description, 260),
    });
  }
  return shaped.slice(0, 200);
}

const normalize = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MODULE = /\b(?:lost\s*(?:and|&|n)\s*found|lost-found|lostfound)\b/;
const ITEM_NOUN = /\b(?:items?|things?|stuff|belongings|property|objects?)\b/;
const LF_WORD = /\b(?:lost|missing|found|unclaimed|uncollected|claimed|collected|returned|handed in|turned in)\b/;
const OBJECT_NOUN = /\b(?:phones?|bottles?|blazers?|calculators?|laptops?|bags?|wallets?|keys?|glasses|umbrellas?|books?|jackets?|cards?|id cards?|watches?|earphones?|headphones?|chargers?|jumpers?|shoes?|instruments?)\b/;
const CLAIM_WORD = /\bclaim(?:ed|ing|s)?\b/;
const EXPLANATION = /\b(?:what (?:does|is) (?:the )?(?:lost\s*(?:and|&)\s*found|it|this page) (?:do|for)|how does (?:the )?lost\s*(?:and|&)\s*found work|what is the lost\s*(?:and|&)\s*found (?:page|module|section))\b/;
const ASKS = /^(?:can|could|would|will|do|does|did|is|are|what|which|who|how|list|read|show|tell|give|any|check|pull|fetch)\b/;

/** True when the message asks for actual Lost & Found records, not a description of the module. */
export function isLostFoundDataRequest(message: string): boolean {
  const value = normalize(message);
  if (!value || value.length > 400) return false;
  if (EXPLANATION.test(value)) return false;
  if (/^(?:open|go to|go back|take me|navigate|bring up|pull up|switch to|head to)\b/.test(value)) return false;
  // Staff-directory questions belong to the contacts tool, even when they mention a submission.
  if (/\b(?:who should i contact|whom should i contact|who do i contact|who teaches|contact (?:for|about)|staff directory)\b/.test(value)) return false;
  const moduleRef = MODULE.test(value);
  // A claim question is about records only when it points at the module, an object or a previous
  // item — "how do I claim a leave request" must not become a Lost & Found query.
  const recordCue = LF_WORD.test(value)
    || (CLAIM_WORD.test(value)
      && (moduleRef || OBJECT_NOUN.test(value) || /\b(?:it|that|this|those|them|items?)\b/.test(value)));
  if (!moduleRef && !recordCue) return false;
  const asks = ASKS.test(value)
    || /\b(?:list|read|check|look up|fetch|get|give me|tell me|show me|how many|which|any|anything|everything|all)\b/.test(value)
    || (OBJECT_NOUN.test(value) && (moduleRef || LF_WORD.test(value)));
  if (!asks) return false;
  // A personal statement such as "I lost my book" is not a request for the module's records.
  if (/^(?:i|we|my|he|she|they)\b/.test(value)
    && !/\b(?:can|could|would|will|do|does|is|are|what|which|how|list|show|tell|give|any|check)\b/.test(value)) return false;
  return true;
}

/** A later turn that refers back to a list ECHO already produced in this session. */
export function isLostFoundFollowUp(message: string): boolean {
  const value = normalize(message);
  if (!value || value.length > 240) return false;
  if (!LF_WORD.test(value) && !/\b(?:first|second|third|fourth|fifth|last|#\d+|number \d+|item \d+|that one|this one|that item|them|those)\b/.test(value)) return false;
  return /^(?:what|which|how|any|is|are|do|can|could|tell|show|more|and|also|open|details?|describe|the|it|that|those|them)\b/.test(value);
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};

function ordinalIn(value: string, total: number): number | null {
  const word = value.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/);
  if (word) return ORDINALS[word[1]];
  if (/\blast\b/.test(value)) return total;
  const numbered = value.match(/(?:#|number|item|no\.?)\s*(\d{1,2})\b/);
  if (numbered) return Number(numbered[1]);
  return null;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value || 'an unknown date';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

const statusText = (status: string): string => STATUS_TEXT[status] || status.replace(/_/g, ' ');

const plural = (count: number, one: string, many = one + 's'): string => `${count} ${count === 1 ? one : many}`;

function describe(item: LostFoundItem): string {
  const where = item.location ? ` (${item.location}, reported ${formatDate(item.dateReported)})` : '';
  return `${item.itemName}${where} — ${statusText(item.status)}`;
}

function card(item: LostFoundItem): EchoRecord {
  return {
    id: `lostfound-${item.id}`,
    title: item.itemName,
    subtitle: item.location || 'Location not recorded',
    meta: [formatDate(item.dateReported), item.category.replace(/_/g, ' ')].filter(Boolean),
    status: statusText(item.status),
  };
}

const visible = (item: LostFoundItem): boolean => item.status !== 'archived';
const foundItems = (items: readonly LostFoundItem[]): LostFoundItem[] =>
  items.filter(item => item.type === 'found' && visible(item));
const lostItems = (items: readonly LostFoundItem[]): LostFoundItem[] =>
  items.filter(item => item.type === 'lost' && visible(item));

function listReply(subject: string, items: readonly LostFoundItem[], tail: string): LostFoundAnswer {
  const shown = items.slice(0, MAX_ITEMS);
  const lines = shown.map(item => '• ' + describe(item));
  if (items.length > shown.length) lines.push(`…and ${items.length - shown.length} more.`);
  return {
    text: `${subject}\n\n${lines.join('\n')}${tail ? `\n\n${tail}` : ''}`,
    records: shown.map(card),
    items: shown,
  };
}

const STOPWORDS = new Set([
  'the', 'all', 'and', 'are', 'any', 'for', 'you', 'can', 'what', 'which', 'list', 'read', 'show',
  'tell', 'give', 'have', 'has', 'there', 'this', 'that', 'them', 'those', 'from', 'with', 'actually',
  'currently', 'right', 'now', 'please', 'about', 'into', 'some', 'more', 'been', 'not', 'its', 'item',
  'items', 'thing', 'things', 'found', 'lost', 'missing', 'unclaimed', 'claimed', 'collected',
  'returned', 'checked', 'look', 'me', 'my', 'our', 'get', 'let', 'know', 'want', 'would', 'could',
]);

function searchTerms(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter(word => word.length >= 3 && !STOPWORDS.has(word))
    .map(word => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word));
}

function matchesTerms(item: LostFoundItem, terms: readonly string[]): boolean {
  const haystack = normalize([item.itemName, item.category, item.description, item.location].join(' '));
  return terms.some(term => haystack.includes(term));
}

/**
 * Deterministic, grounded answers. `previous` is this session's last result set, which is what
 * makes "the second one" and "can I claim it" resolvable without asking the user to repeat.
 */
export function answerLostFoundRequest(
  message: string,
  items: readonly LostFoundItem[],
  options: { previous?: readonly LostFoundItem[]; alreadyExplained?: boolean } = {}
): LostFoundAnswer {
  const value = normalize(message);
  const previous = options.previous?.length ? options.previous : null;
  const found = foundItems(items);
  const lost = lostItems(items);
  const available = items.filter(visible);

  if (!available.length) {
    return {
      text: 'There’s nothing in Lost & Found right now — no lost items and nothing handed in. If something turns up, it’ll appear on the Lost & Found page.',
      records: [],
      items: [],
    };
  }

  const pool = previous || available;
  const ordinal = ordinalIn(value, pool.length);
  const wantsDetail = /\b(?:tell me more|more about|details?|more info|describe|what about)\b/.test(value)
    || (ordinal !== null && /\bone\b/.test(value));
  const asksClaimWorkflow = CLAIM_WORD.test(value)
    && /\b(?:can|could|how|do|does|should|may|would|is|i)\b/.test(value)
    && !/\b(?:haven'?t|have not|not|never)\s+(?:been\s+)?claimed\b/.test(value)
    && !/\bunclaimed\b/.test(value);
  const terms = searchTerms(value)
    .filter(term => !['claim', 'claims', 'claimed', 'item', 'items'].includes(term));
  const target = (ordinal ? pool[ordinal - 1] : undefined)
    || (terms.length ? pool.find(item => matchesTerms(item, terms)) : undefined);
  const outOfRange = ordinal !== null && ordinal > pool.length;

  // 1. A specific record, by position or by name: "tell me more about the second one", "claim the blazer".
  if (asksClaimWorkflow || wantsDetail) {
    if (outOfRange) {
      return {
        text: `I only have ${plural(pool.length, 'item')} in front of me, so there’s no item ${ordinal}. Ask about any of these by name and I’ll pull it up.`,
        records: pool.slice(0, MAX_ITEMS).map(card),
        items: pool.slice(0, MAX_ITEMS),
      };
    }
    if (!target) {
      return {
        text: `Which item do you mean? ${pool.slice(0, MAX_ITEMS).map(item => item.itemName).join('; ')}.`,
        records: pool.slice(0, MAX_ITEMS).map(card),
        items: pool.slice(0, MAX_ITEMS),
      };
    }
    if (asksClaimWorkflow) {
      const claimLine = target.status === 'claim_pending'
        ? 'A claim is already pending, so a coordinator is verifying it — nothing more to do for now.'
        : target.status === 'claimed'
          ? 'It’s already been claimed and returned, so there’s nothing left to claim.'
          : target.status === 'verified'
            ? 'Yes — it’s verified and waiting at the collection point. Open Lost & Found, pick it and choose Claim to confirm it’s yours.'
            : 'It hasn’t been claimed yet. Open Lost & Found, pick it from the list and choose Claim; a coordinator verifies ownership before it’s released.';
      return {
        text: [
          `${target.itemName}`,
          `Where: ${target.location || 'not recorded'}. Status: ${statusText(target.status)}.`,
          claimLine,
        ].join('\n'),
        records: [card(target)],
        items: [target],
      };
    }
    return {
      text: [
        target.itemName,
        `Where: ${target.location || 'not recorded'}. Reported ${formatDate(target.dateReported)}.`,
        `Status: ${statusText(target.status)}.`,
        target.description,
        target.status === 'reported' || target.status === 'verified'
          ? 'It hasn’t been claimed yet — open Lost & Found to start a claim.'
          : '',
      ].filter(Boolean).join('\n'),
      records: [card(target)],
      items: [target],
    };
  }

  // 2. Unclaimed-only questions, which are a filter rather than a full list.
  if (/\b(?:haven'?t|have not|not|never)\s+(?:been\s+)?claimed\b|\bunclaimed\b|\bavailable to claim\b|\bstill (?:there|unclaimed)\b/.test(value)) {
    const open = found.filter(item => item.status === 'reported');
    const pending = found.filter(item => item.status === 'claim_pending');
    if (!open.length) {
      return listReply(
        pending.length
          ? `${plural(pending.length, 'found item')} still open, but ${pending.length === 1 ? 'a claim is' : 'claims are'} already pending on ${pending.length === 1 ? 'it' : 'them'}:`
          : 'Nothing in the found list is unclaimed — everything handed in has been claimed or archived.',
        pending.length ? pending : found,
        'A pending claim means a coordinator is still verifying ownership.'
      );
    }
    return listReply(
      `${plural(open.length, 'found item')} not claimed yet:`,
      open,
      pending.length
        ? `Separately, ${plural(pending.length, 'item')} ${pending.length === 1 ? 'has' : 'have'} a claim pending review (${pending.map(item => item.itemName).join('; ')}).`
        : 'A coordinator verifies ownership before anything is released.'
    );
  }

  // 3. A narrower ask such as "any found phones", answered honestly when nothing matches.
  const contentTerms = terms.filter(term => !['lost', 'found', 'module', 'page', 'answer', 'there'].includes(term));
  if (contentTerms.length) {
    const hits = found.filter(item => matchesTerms(item, contentTerms));
    if (hits.length) {
      return listReply(
        `${plural(hits.length, 'found item')} matching “${contentTerms.join(' ')}”:`,
        hits,
        'If one of these is yours, open Lost & Found and file a claim.'
      );
    }
    const others = found.filter(item => item.status !== 'claimed');
    return {
      text: others.length
        ? `I don’t see anything matching “${contentTerms.join(' ')}” in the found list. What is listed: ${others.map(item => item.itemName).join('; ')}.`
        : `I don’t see anything matching “${contentTerms.join(' ')}” in the found list, and nothing else is listed as found right now.`,
      records: others.slice(0, MAX_ITEMS).map(card),
      items: others.slice(0, MAX_ITEMS),
    };
  }

  // 4. The general question: what has actually been found.
  // "lost and found" names the module; only an explicit missing-item ask adds the second section.
  const rest = value.replace(/\blost\s*(?:and|&|n)\s*found\b/g, ' ');
  const asksLostToo = /\b(?:lost|missing)\b/.test(rest) && !/\bfound\b/.test(rest);
  const foundLine = found.length
    ? `Right now ${found.length === 1 ? 'there is 1 item' : `there are ${found.length} items`} listed as found${options.alreadyExplained ? '' : ' in Lost & Found'}:`
    : 'Nothing is currently listed as found.';
  if (!found.length && !asksLostToo) {
    return { text: foundLine, records: [], items: [] };
  }
  const answer = listReply(
    foundLine,
    found,
    found.length ? 'If one of these is yours, open Lost & Found and file a claim so a coordinator can verify it.' : ''
  );
  if (asksLostToo && lost.length) {
    answer.text += `\n\nReported missing:\n${lost.slice(0, MAX_ITEMS).map(item => '• ' + describe(item)).join('\n')}`;
    answer.items = [...answer.items, ...lost.slice(0, MAX_ITEMS)];
    answer.records = [...answer.records, ...lost.slice(0, MAX_ITEMS).map(card)];
  }
  return answer;
}

export const LOST_FOUND_UNAVAILABLE =
  'I couldn’t reach the Lost & Found records just now, so I won’t guess at what’s listed. The Lost & Found page shows the live list, and I can take you there if you like.';
