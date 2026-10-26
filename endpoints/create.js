import { ensureSchema } from '../lib/db.js';
import { cleanName, cleanPin, hashPin, isValidPin, makeCode, makeToken, readJson, requireMethod, send, sessionCookie } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const { name, pin } = await readJson(req);
    const clean = cleanName(name);
    if (clean.length < 2) return send(res, 400, { ok: false, error: 'Напиши имя или короткое обращение.' });
    if (!isValidPin(pin)) return send(res, 400, { ok: false, error: 'PIN должен состоять из 4–8 цифр.' });

    let pair;
    for (let attempt = 0; attempt < 10 && !pair; attempt += 1) {
      try {
        const rows = await db`INSERT INTO pairs (invite_code) VALUES (${makeCode()}) RETURNING id, invite_code`;
        pair = rows[0];
      } catch (error) {
        if (error.code !== '23505') throw error;
      }
    }
    if (!pair) return send(res, 500, { ok: false, error: 'Не удалось создать код. Попробуй ещё раз.' });

    const userRows = await db`INSERT INTO users (pair_id, name, pin_hash) VALUES (${pair.id}, ${clean}, ${hashPin(pin)}) RETURNING id`;
    const token = makeToken();
    await db`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userRows[0].id}, NOW() + INTERVAL '30 days')`;
    return send(res, 200, { ok: true, invite_code: pair.invite_code }, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось создать ящик. Проверь подключение базы.' });
  }
}
