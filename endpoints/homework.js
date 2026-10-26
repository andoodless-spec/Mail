import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

async function readHomework(db, user) {
  const cases = await db`
    SELECT id, note_id, problem, created_at
    FROM homework_cases
    WHERE pair_id = ${user.pair_id} AND closed_at IS NULL
    ORDER BY created_at DESC
  `;
  const members = await db`SELECT id FROM users WHERE pair_id = ${user.pair_id}`;
  const result = [];
  for (const current of cases) {
    const answers = await db`
      SELECT user_id, body, created_at FROM homework_answers WHERE case_id = ${current.id}
    `;
    const mine = answers.find((answer) => answer.user_id === user.id) || null;
    const partner = answers.find((answer) => answer.user_id !== user.id) || null;
    const ready = members.length >= 2 && answers.length >= 2;
    result.push({
      id: current.id,
      note_id: current.note_id,
      problem: current.problem,
      created_at: new Date(current.created_at).toISOString(),
      my_answer: mine ? { body: mine.body, created_at: new Date(mine.created_at).toISOString() } : null,
      partner_submitted: Boolean(partner),
      ready,
      partner_answer: ready && partner ? { body: partner.body, created_at: new Date(partner.created_at).toISOString() } : null,
    });
  }
  return { cases: result };
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });

    if (req.method === 'GET') {
      return send(res, 200, { ok: true, ...(await readHomework(db, user)) });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST' });

    const data = await readJson(req);
    if (data.action === 'create') {
      const noteId = Number(data.note_id);
      const notes = await db`
        SELECT id, body FROM notes
        WHERE id = ${noteId} AND pair_id = ${user.pair_id} AND category = 'hard'
        LIMIT 1
      `;
      if (!notes[0]) return send(res, 404, { ok: false, error: 'Эта гадость уже недоступна для разбора.' });
      const existing = await db`SELECT id FROM homework_cases WHERE pair_id = ${user.pair_id} AND note_id = ${noteId} AND closed_at IS NULL LIMIT 1`;
      if (existing[0]) {
        await db`DELETE FROM notes WHERE id = ${noteId} AND pair_id = ${user.pair_id}`;
        return send(res, 200, { ok: true, id: existing[0].id, ...(await readHomework(db, user)) });
      }
      const rows = await db`
        INSERT INTO homework_cases (pair_id, note_id, problem)
        VALUES (${user.pair_id}, ${notes[0].id}, ${notes[0].body})
        RETURNING id
      `;
      await db`DELETE FROM notes WHERE id = ${noteId} AND pair_id = ${user.pair_id}`;
      return send(res, 200, { ok: true, id: rows[0].id, ...(await readHomework(db, user)) });
    }

    if (data.action === 'close') {
      const caseId = Number(data.case_id);
      if (!Number.isInteger(caseId)) return send(res, 400, { ok: false, error: 'Не удалось закрыть задание.' });
      await db`UPDATE homework_cases SET closed_at = NOW() WHERE id = ${caseId} AND pair_id = ${user.pair_id} AND closed_at IS NULL`;
      return send(res, 200, { ok: true, ...(await readHomework(db, user)) });
    }

    if (data.action === 'answer') {
      const caseId = Number(data.case_id);
      const body = String(data.body || '').trim();
      if (!Number.isInteger(caseId) || body.length < 5 || body.length > 3500) {
        return send(res, 400, { ok: false, error: 'Опиши ситуацию и своё решение — хотя бы несколькими словами.' });
      }
      const cases = await db`SELECT id FROM homework_cases WHERE id = ${caseId} AND pair_id = ${user.pair_id} AND closed_at IS NULL LIMIT 1`;
      if (!cases[0]) return send(res, 404, { ok: false, error: 'Домашнее задание уже закрыто.' });
      await db`
        INSERT INTO homework_answers (case_id, user_id, body)
        VALUES (${caseId}, ${user.id}, ${body})
        ON CONFLICT (case_id, user_id) DO UPDATE SET body = EXCLUDED.body, created_at = NOW()
      `;
      return send(res, 200, { ok: true, ...(await readHomework(db, user)) });
    }

    return send(res, 400, { ok: false, error: 'Неизвестное действие.' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить домашнее задание.' });
  }
}
