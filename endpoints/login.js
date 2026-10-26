import { ensureSchema } from '../lib/db.js';
import { cleanName, cleanPin, isValidPin, makeToken, readJson, requireMethod, send, sessionCookie, verifyPin } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const { name, code, pin } = await readJson(req);
    const clean = cleanName(name);
    const inviteCode = String(code || '').trim().toUpperCase();
    const enteredPin = cleanPin(pin);
    if (clean.length < 2 || !isValidPin(enteredPin)) return send(res, 400, { ok: false, error: 'Нужны имя и личный PIN из 4–8 цифр.' });

    let users;
    if (inviteCode) {
      const pairs = await db`SELECT id FROM pairs WHERE invite_code = ${inviteCode} LIMIT 1`;
      if (!pairs[0]) return send(res, 401, { ok: false, error: 'Имя, код или PIN не подошли.' });
      users = await db`SELECT id, name, pin_hash FROM users WHERE pair_id = ${pairs[0].id}`;
    } else {
      // После первого подключения код пары не нужен: имя и личный PIN
      // однозначно возвращают участника в его существующий ящик.
      users = await db`SELECT id, name, pin_hash FROM users WHERE LOWER(name) = LOWER(${clean}) ORDER BY id DESC`;
    }

    const matches = users.filter((candidate) => candidate.name.trim().toLowerCase() === clean.toLowerCase() && candidate.pin_hash && verifyPin(enteredPin, candidate.pin_hash));
    if (!matches[0]) return send(res, 401, { ok: false, error: 'Имя или PIN не подошли.' });
    const user = matches[0];
    const token = makeToken();
    await db`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${user.id}, NOW() + INTERVAL '30 days')`;
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось войти в ящик.' });
  }
}
