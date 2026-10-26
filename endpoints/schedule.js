import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, requireMethod, send } from '../lib/http.js';
import { dateKeyNow } from '../lib/state.js';

function validDateKey(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const date = new Date(`${raw}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    if (user.opened_at) return send(res, 409, { ok: false, error: 'Сначала завершите текущий цикл.' });
    const { scheduled_date: rawDate } = await readJson(req);
    const scheduledDate = String(rawDate || '').trim();
    const timeZone = process.env.TIMEZONE || 'Europe/Amsterdam';
    if (!validDateKey(scheduledDate) || scheduledDate < dateKeyNow(timeZone)) {
      return send(res, 400, { ok: false, error: 'Выбери сегодняшнюю или будущую дату.' });
    }
    const rows = await db`
      UPDATE pairs
      SET scheduled_date = ${scheduledDate}::date,
          scheduled_for = ${`${scheduledDate}T00:00:00.000Z`}::timestamptz,
          opened_at = NULL
      WHERE id = ${user.pair_id}
      RETURNING TO_CHAR(scheduled_date, 'YYYY-MM-DD') AS scheduled_date
    `;
    return send(res, 200, { ok: true, scheduled_date: rows[0]?.scheduled_date || scheduledDate });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить дату.' });
  }
}
