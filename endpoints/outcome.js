import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, requireMethod, send } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const { result } = await readJson(req);
    if (!['resolved', 'not_yet'].includes(result)) return send(res, 400, { ok: false, error: 'Выбери один из вариантов.' });
    await db`INSERT INTO talk_outcomes (pair_id, user_id, result) VALUES (${user.pair_id}, ${user.id}, ${result})`;
    const achievementKind = result === 'resolved' ? 'talk_resolved' : 'talk_kept_trying';
    await db`INSERT INTO achievements (user_id, kind) SELECT id, ${achievementKind} FROM users WHERE pair_id = ${user.pair_id} ON CONFLICT (user_id, kind) DO NOTHING`;
    return send(res, 200, { ok: true, result, achievement: { kind: achievementKind } });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить итог разговора.' });
  }
}
