import { ensureSchema } from '../lib/db.js';
import { clearSessionCookie, currentUser, parseCookies, requireMethod, send } from '../lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;
  try {
    const db = await ensureSchema();
    const token = parseCookies(req).mailbox_session;
    if (token) await db`DELETE FROM sessions WHERE token = ${token}`;
    return send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось выйти.' }, { 'Set-Cookie': clearSessionCookie });
  }
}
