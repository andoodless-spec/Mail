import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });

    if (req.method === 'DELETE') {
      const url = new URL(req.url || '/', 'https://quiet-mailbox.local');
      const noteId = Number(url.searchParams.get('id'));
      if (!Number.isInteger(noteId)) return send(res, 400, { ok: false, error: 'Не удалось найти запись.' });
      await db`DELETE FROM notes WHERE id = ${noteId} AND pair_id = ${user.pair_id}`;
      return send(res, 200, { ok: true });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'POST, DELETE' });
    if (user.opened_at) return send(res, 409, { ok: false, error: 'Сначала завершите текущий цикл обсуждения.' });
    const { category, body } = await readJson(req);
    const text = String(body || '').trim();
    if (!['sweet', 'hard'].includes(category)) return send(res, 400, { ok: false, error: 'Выбери категорию записи.' });
    if (!text || text.length > 3500) return send(res, 400, { ok: false, error: 'Текст должен быть от 1 до 3500 символов.' });
    await db`INSERT INTO notes (pair_id, author_id, category, body) VALUES (${user.pair_id}, ${user.id}, ${category}, ${text})`;

    const total = await db`SELECT COUNT(*)::int AS count FROM notes WHERE author_id = ${user.id}`;
    const byCategory = await db`SELECT COUNT(*)::int AS count FROM notes WHERE author_id = ${user.id} AND category = ${category}`;
    const unlocked = [];
    if (Number(total[0]?.count) === 1) unlocked.push('first_share');
    if (Number(byCategory[0]?.count) === 1) unlocked.push(`${category}_share`);
    for (const kind of unlocked) {
      await db`INSERT INTO achievements (user_id, kind) VALUES (${user.id}, ${kind}) ON CONFLICT (user_id, kind) DO NOTHING`;
    }
    return send(res, 200, { ok: true, achievement: unlocked[0] ? { kind: unlocked[0] } : null });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить запись.' });
  }
}
