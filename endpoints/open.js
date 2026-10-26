import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, requireMethod, send } from '../lib/http.js';
import { dateKeyNow } from '../lib/state.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const { now } = await readJson(req);
    if (!now) {
      if (user.scheduled_date) {
        const today = dateKeyNow(process.env.TIMEZONE || 'Europe/Amsterdam');
        if (String(user.scheduled_date).slice(0, 10) > today) return send(res, 400, { ok: false, error: 'День разговора ещё не наступил.' });
      } else if (!user.scheduled_for) {
        return send(res, 400, { ok: false, error: 'Сначала выберите дату разговора.' });
      } else if (new Date(user.scheduled_for).getTime() > Date.now()) {
        return send(res, 400, { ok: false, error: 'Время разговора ещё не наступило.' });
      }
    }
    await db`UPDATE pairs SET opened_at = NOW() WHERE id = ${user.pair_id} AND opened_at IS NULL`;
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось открыть записи.' });
  }
}
