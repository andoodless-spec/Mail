import { ensureSchema } from '../lib/db.js';
import { cleanName, cleanPin, currentUser, hashPin, isValidPin, readJson, requireMethod, send } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const body = await readJson(req);
    const hasName = body.name !== undefined && String(body.name || '').trim() !== '';
    const hasPin = body.pin !== undefined && String(body.pin || '').trim() !== '';
    if (!hasName && !hasPin) {
      return send(res, 400, { ok: false, error: 'Укажите новое имя профиля или новый пароль (PIN).' });
    }
    let updatedName = user.name;
    if (hasName) {
      const clean = cleanName(body.name);
      if (clean.length < 2) {
        return send(res, 400, { ok: false, error: 'Имя должно содержать хотя бы 2 символа.' });
      }
      await db`UPDATE users SET name = ${clean} WHERE id = ${user.id}`;
      updatedName = clean;
    }
    if (hasPin) {
      if (!isValidPin(body.pin)) {
        return send(res, 400, { ok: false, error: 'Пароль (PIN) должен состоять из 4–8 цифр.' });
      }
      await db`UPDATE users SET pin_hash = ${hashPin(cleanPin(body.pin))} WHERE id = ${user.id}`;
    }
    return send(res, 200, { ok: true, name: updatedName });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить настройки профиля.' });
  }
}
