import { ensureSchema } from '../lib/db.js';
import { currentUser, requireMethod, send } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    if (!user.opened_at) return send(res, 400, { ok: false, error: 'Записи ещё не открыты.' });
    await db`DELETE FROM notes WHERE pair_id = ${user.pair_id}`;
    await db`DELETE FROM talk_outcomes WHERE pair_id = ${user.pair_id}`;
    await db`UPDATE pairs SET scheduled_date = NULL, scheduled_for = NULL, opened_at = NULL WHERE id = ${user.pair_id}`;
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось завершить цикл.' });
  }
}
