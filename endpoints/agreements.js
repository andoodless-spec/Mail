import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

const STATUSES = new Set(['try', 'working', 'done', 'revisit']);

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);

    if (req.method === 'GET') {
      const rows = await db`
        SELECT id, body, status, created_at, updated_at
        FROM agreements
        WHERE pair_id = ${user.pair_id}
        ORDER BY updated_at DESC
      `;
      return send(res, 200, { ok: true, agreements: rows.map((item) => ({ id: item.id, text: item.body, status: item.status, created_at: new Date(item.created_at).toISOString(), updated_at: new Date(item.updated_at).toISOString() })) });
    }

    if (req.method === 'POST') {
      const { text } = await readJson(req);
      const body = String(text || '').trim();
      if (body.length < 3 || body.length > 500) return send(res, 400, { ok: false, error: 'Договорённость должна быть от 3 до 500 символов.' });
      const rows = await db`INSERT INTO agreements (pair_id, user_id, body) VALUES (${user.pair_id}, ${user.id}, ${body}) RETURNING id`;
      return send(res, 200, { ok: true, id: rows[0].id });
    }

    if (req.method === 'PATCH') {
      const id = Number(query.get('id'));
      const { status } = await readJson(req);
      if (!Number.isInteger(id) || !STATUSES.has(status)) return send(res, 400, { ok: false, error: 'Не удалось обновить договорённость.' });
      await db`UPDATE agreements SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id}`;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const id = Number(query.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти договорённость.' });
      await db`DELETE FROM agreements WHERE id = ${id} AND pair_id = ${user.pair_id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить договорённость.' });
  }
}
