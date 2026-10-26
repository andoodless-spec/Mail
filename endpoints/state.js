import { ensureSchema } from '../lib/db.js';
import { currentUser, send } from '../lib/http.js';
import { buildState } from '../lib/state.js';

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    return send(res, 200, await buildState(db, user));
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось загрузить ящик.' });
  }
}
