import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

function itemData(row, userId) {
  return {
    id: Number(row.id),
    text: row.body,
    is_hidden: Boolean(row.is_hidden),
    mine: Number(row.user_id) === Number(userId),
    author: row.name || 'Кто-то из вас',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);

    if (req.method === 'GET') {
      const rows = await db`
        SELECT a.id, a.body, a.is_hidden, a.user_id, a.created_at, a.updated_at, u.name
        FROM anniversary_ideas a
        JOIN users u ON u.id = a.user_id
        WHERE a.pair_id = ${user.pair_id}
        ORDER BY a.updated_at DESC, a.id DESC
      `;
      return send(res, 200, {
        ok: true,
        ideas: rows.filter((row) => !row.is_hidden).map((row) => itemData(row, user.id)),
        hidden: rows.filter((row) => row.is_hidden).map((row) => itemData(row, user.id)),
      });
    }

    if (req.method === 'POST') {
      const data = await readJson(req);
      const text = String(data.text || '').trim();
      if (text.length < 3 || text.length > 500) return send(res, 400, { ok: false, error: 'Идея должна быть от 3 до 500 символов.' });
      const rows = await db`
        INSERT INTO anniversary_ideas (pair_id, user_id, body)
        VALUES (${user.pair_id}, ${user.id}, ${text})
        RETURNING id
      `;
      return send(res, 200, { ok: true, id: rows[0].id });
    }

    const id = Number(query.get('id'));
    if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти идею.' });

    if (req.method === 'PATCH') {
      const data = await readJson(req);
      if (typeof data.is_hidden !== 'boolean') return send(res, 400, { ok: false, error: 'Не удалось скрыть идею.' });
      await db`
        UPDATE anniversary_ideas
        SET is_hidden = ${data.is_hidden}, updated_at = NOW()
        WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}
      `;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await db`DELETE FROM anniversary_ideas WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось обновить идеи для годовщины.' });
  }
}
