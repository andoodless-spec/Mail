import { ensureSchema } from '../lib/db.js';
import { cleanName, cleanPin, hashPin, isValidPin, makeToken, readJson, requireMethod, send, sessionCookie } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const { name, code, pin } = await readJson(req);
    const clean = cleanName(name);
    const inviteCode = String(code || '').trim().toUpperCase();
    if (clean.length < 2 || !inviteCode) return send(res, 400, { ok: false, error: 'Нужны имя и код пары.' });
    if (!isValidPin(pin)) return send(res, 400, { ok: false, error: 'PIN должен состоять из 4–8 цифр.' });
    const pairs = await db`SELECT id FROM pairs WHERE invite_code = ${inviteCode} LIMIT 1`;
    if (!pairs[0]) return send(res, 404, { ok: false, error: 'Такого кода нет.' });
    const counts = await db`SELECT COUNT(*)::int AS count FROM users WHERE pair_id = ${pairs[0].id}`;
    if (Number(counts[0].count) >= 2) return send(res, 409, { ok: false, error: 'В этом ящике уже два участника.' });
    const users = await db`INSERT INTO users (pair_id, name, pin_hash) VALUES (${pairs[0].id}, ${clean}, ${hashPin(pin)}) RETURNING id`;
    const token = makeToken();
    await db`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${users[0].id}, NOW() + INTERVAL '30 days')`;
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось подключиться к ящику.' });
  }
}
