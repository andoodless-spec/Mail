import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';
import { mergePreferences, normalizePreferences } from '../lib/preferences.js';

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });

    if (req.method === 'GET') {
      return send(res, 200, { ok: true, preferences: normalizePreferences(user.preferences) });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST' });

    const body = await readJson(req);
    const preferences = mergePreferences(user.preferences, body);
    await db`UPDATE users SET preferences = ${JSON.stringify(preferences)}::jsonb WHERE id = ${user.id}`;
    return send(res, 200, { ok: true, preferences });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить персонализацию.' });
  }
}
