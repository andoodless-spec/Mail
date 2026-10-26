import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

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
        SELECT id, body, user_id, created_at
        FROM site_feedback
        WHERE pair_id = ${user.pair_id} AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      return send(res, 200, {
        ok: true,
        ideas: rows.map((item) => ({ id: item.id, text: item.body, mine: item.user_id === user.id, created_at: new Date(item.created_at).toISOString() })),
      });
    }

    if (req.method === 'POST') {
      const { text } = await readJson(req);
      const body = String(text || '').trim();
      if (body.length < 2 || body.length > 2000) return send(res, 400, { ok: false, error: 'Идея должна быть от 2 до 2000 символов.' });
      const rows = await db`
        INSERT INTO site_feedback (pair_id, user_id, body)
        VALUES (${user.pair_id}, ${user.id}, ${body})
        RETURNING id, created_at
      `;
      return send(res, 200, { ok: true, id: rows[0].id, created_at: new Date(rows[0].created_at).toISOString() });
    }

    if (req.method === 'DELETE') {
      const id = Number(query.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти идею.' });
      await db`UPDATE site_feedback SET deleted_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить идею для будущих поправок.' });
  }
}
