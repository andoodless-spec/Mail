import { normalizePreferences } from './preferences.js';

export function dateKeyNow(timeZone = 'Europe/Amsterdam') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyFromValue(value, timeZone = 'Europe/Amsterdam') {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return null;
  }
}

export async function buildState(db, user) {
  const timeZone = process.env.TIMEZONE || 'Europe/Amsterdam';
  const members = await db`SELECT id, name FROM users WHERE pair_id = ${user.pair_id} ORDER BY id`;
  const counts = await db`
    SELECT category, COUNT(*)::int AS count
    FROM notes
    WHERE pair_id = ${user.pair_id} AND author_id = ${user.id}
    GROUP BY category
  `;
  const lastNote = await db`SELECT MAX(created_at) AS last_note_at FROM notes WHERE pair_id = ${user.pair_id} AND author_id = ${user.id}`;
  const opened = Boolean(user.opened_at);
  let notes = [];
  if (opened) {
    notes = await db`
      SELECT n.id, n.category, n.body, n.created_at, u.name AS author
      FROM notes n JOIN users u ON u.id = n.author_id
      WHERE n.pair_id = ${user.pair_id}
      ORDER BY n.created_at, n.id
    `;
  }
  const scheduledCandidate = user.scheduled_date ? String(user.scheduled_date).slice(0, 10) : '';
  const scheduledDate = /^\d{4}-\d{2}-\d{2}$/.test(scheduledCandidate) ? scheduledCandidate : null;
  let legacyScheduled = null;
  if (user.scheduled_for) {
    const parsed = new Date(user.scheduled_for);
    if (!Number.isNaN(parsed.getTime())) legacyScheduled = parsed.toISOString();
  }
  const canOpen = scheduledDate
    ? !opened && dateKeyNow(timeZone) >= scheduledDate
    : Boolean(legacyScheduled && !opened && new Date(legacyScheduled).getTime() <= Date.now());
  const partner = members.find((member) => member.id !== user.id) || null;
  const achievements = await db`
    SELECT kind, created_at FROM achievements WHERE user_id = ${user.id} ORDER BY created_at DESC
  `;
  const latestOutcome = await db`
    SELECT result, created_at FROM talk_outcomes WHERE pair_id = ${user.pair_id} ORDER BY created_at DESC LIMIT 1
  `;
  return {
    ok: true,
    user: { id: user.id, name: user.name },
    partner,
    preferences: normalizePreferences(user.preferences),
    pair_code: user.invite_code,
    timezone: timeZone,
    pin_set: Boolean(user.pin_hash),
    scheduled_date: scheduledDate || dateKeyFromValue(legacyScheduled, timeZone),
    scheduled_for: scheduledDate || legacyScheduled,
    opened,
    can_open: canOpen,
    nudge_enabled: Boolean(user.nudge_enabled),
    latest_outcome: latestOutcome[0] ? { result: latestOutcome[0].result, created_at: new Date(latestOutcome[0].created_at).toISOString() } : null,
    last_note_at: lastNote[0]?.last_note_at ? new Date(lastNote[0].last_note_at).toISOString() : null,
    counts: {
      sweet: Number(counts.find((row) => row.category === 'sweet')?.count || 0),
      hard: Number(counts.find((row) => row.category === 'hard')?.count || 0),
    },
    achievements: achievements.map((item) => ({ kind: item.kind, created_at: new Date(item.created_at).toISOString() })),
    notes: notes.map((note) => ({ ...note, created_at: new Date(note.created_at).toISOString() })),
  };
}
