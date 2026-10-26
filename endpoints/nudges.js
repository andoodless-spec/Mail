import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, requireMethod, send } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const { enabled } = await readJson(req);
    await db`UPDATE pairs SET nudge_enabled = ${Boolean(enabled)} WHERE id = ${user.pair_id}`;
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить настройку.' });
  }
}
