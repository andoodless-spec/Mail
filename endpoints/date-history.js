import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });

    if (req.method === 'GET') {
      const rows = await db`
        SELECT id, kind, place, idea_text, reflection, repeat_wanted, created_at
        FROM date_history
        WHERE pair_id = ${user.pair_id} AND status = 'completed'
        ORDER BY created_at DESC
      `;
      return send(res, 200, {
        ok: true,
        dates: rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          place: row.place,
          idea: row.idea_text,
          reflection: row.reflection || '',
          repeat: row.repeat_wanted,
          created_at: new Date(row.created_at).toISOString(),
        })),
      });
    }

    if (req.method === 'POST') {
      const data = await readJson(req);
      const kind = String(data.kind || '').trim();
      const place = String(data.place || '').trim();
      const idea = String(data.idea || '').trim();
      const status = String(data.status || '').trim();
      const reason = String(data.reason || '').trim().slice(0, 2000);
      const alternative = String(data.alternative || '').trim().slice(0, 300);
      const reflection = String(data.reflection || '').trim().slice(0, 2000);
      if (!['budget', 'treat'].includes(kind) || !['outside', 'inside'].includes(place) || idea.length < 3 || !['completed', 'declined'].includes(status)) {
        return send(res, 400, { ok: false, error: 'Не удалось сохранить историю свидания.' });
      }
      const repeat = data.repeat === true || data.repeat === 'yes';
      const rows = await db`
        INSERT INTO date_history (pair_id, user_id, kind, place, idea_text, status, reason, alternative, reflection, repeat_wanted)
        VALUES (${user.pair_id}, ${user.id}, ${kind}, ${place}, ${idea}, ${status}, ${reason || null}, ${alternative || null}, ${reflection || null}, ${status === 'completed' ? repeat : null})
        RETURNING id
      `;
      const achievementKind = status === 'completed' ? 'date_together' : 'date_try_again';
      await db`INSERT INTO achievements (user_id, kind) SELECT id, ${achievementKind} FROM users WHERE pair_id = ${user.pair_id} ON CONFLICT (user_id, kind) DO NOTHING`;
      return send(res, 200, { ok: true, id: rows[0].id, achievement: { kind: achievementKind } });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить историю свидания.' });
  }
}
