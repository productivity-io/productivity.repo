import type { SubjectOption } from './echoCommands';

// Options come only from the already-authenticated Assignments page. No extra API calls.
const registrations = new Map<number, { key: symbol; options: SubjectOption[] }>();
export function registerEchoSubjects(userId: number, subjects: { id: number; name: string; code?: string }[]) {
  const key = Symbol();
  const options = subjects.slice(0, 100).filter(s => Number.isSafeInteger(s.id) && s.id > 0 && typeof s.name === 'string' && s.name.length <= 100)
    .map(s => ({ value: String(s.id), label: s.name,
      aliases: [...(s.code ? [s.code] : []), ...(/\bmathematics\b/i.test(s.name) ? ['math', 'maths', 'mathematics'] : [])] }));
  registrations.set(userId, { key, options });
  return () => { if (registrations.get(userId)?.key === key) registrations.delete(userId); };
}
export const getEchoSubjects = (userId: number) => registrations.get(userId)?.options || [];
