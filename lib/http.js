import crypto from 'node:crypto';

export function send(res, status, payload, headers = {}) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).json(payload);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function cleanPin(value) {
  return String(value || '').trim();
}

export function isValidPin(value) {
  return /^\d{4,8}$/.test(cleanPin(value));
}

export function hashPin(value) {
  const pin = cleanPin(value);
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${digest}`;
}

export function verifyPin(value, stored) {
  try {
    const [salt, hex] = String(stored || '').split(':');
    if (!salt || !hex) return false;
    const actual = crypto.scryptSync(cleanPin(value), salt, 32);
    const expected = Buffer.from(hex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
}

export function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function parseCookies(req) {
  const result = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index > -1) result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return result;
}

export function sessionCookie(token) {
  return `mailbox_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export const clearSessionCookie = 'mailbox_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export async function currentUser(req, db) {
  const token = parseCookies(req).mailbox_session;
  if (!token) return null;
  const rows = await db`
    SELECT u.id, u.pair_id, u.name, u.pin_hash, u.preferences,
           p.invite_code, p.scheduled_for, TO_CHAR(p.scheduled_date, 'YYYY-MM-DD') AS scheduled_date, p.opened_at,
           p.nudge_enabled
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN pairs p ON p.id = u.pair_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] || null;
}

export function requireMethod(req, res, method = 'POST') {
  if (req.method !== method) {
    send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: method });
    return false;
  }
  return true;
}
