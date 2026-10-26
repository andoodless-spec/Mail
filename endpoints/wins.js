import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const url = new URL(req.url || '/', 'https://quiet-mailbox.local');

    if (req.method === 'GET') {
      const rows = await db`SELECT id, body, created_at FROM small_wins WHERE pair_id = ${user.pair_id} AND deleted_at IS NULL ORDER BY created_at DESC`;
      return send(res, 200, { ok: true, wins: rows.map((item) => ({ id: item.id, text: item.body, created_at: new Date(item.created_at).toISOString() })) });
    }
    if (req.method === 'POST') {
      const { text } = await readJson(req);
      const body = String(text || '').trim();
      if (body.length < 2 || body.length > 500) return send(res, 400, { ok: false, error: 'Победа должна быть от 2 до 500 символов.' });
      const rows = await db`INSERT INTO small_wins (pair_id, user_id, body) VALUES (${user.pair_id}, ${user.id}, ${body}) RETURNING id`;
      return send(res, 200, { ok: true, id: rows[0].id });
    }
    if (req.method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти победу.' });
      await db`UPDATE small_wins SET deleted_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id}`;
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить маленькую победу.' });
  }
}
