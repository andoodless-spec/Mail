import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

function parseFields(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

const PARTNER_PROFILE_ACCENTS = new Set(['theme', 'rose', 'lilac', 'sky', 'sage', 'sun']);

function sanitizeFields(value) {
  const fields = parseFields(value);
  const result = [];
  fields.slice(0, 24).forEach((field, index) => {
    const label = String(field?.label || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    const body = String(field?.value || '').trim().replace(/\s+/g, ' ').slice(0, 300);
    if (!label) return;
    result.push({
      id: String(field?.id || `field_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `field_${index + 1}`,
      label,
      value: body,
      accent: PARTNER_PROFILE_ACCENTS.has(String(field?.accent || 'theme')) ? String(field?.accent || 'theme') : 'theme',
    });
  });
  return result;
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const members = await db`SELECT id, name FROM users WHERE pair_id = ${user.pair_id} AND id <> ${user.id} LIMIT 1`;
    const partner = members[0] || null;

    if (req.method === 'GET') {
      if (!partner) return send(res, 200, { ok: true, partner: null, fields: null });
      const rows = await db`
        SELECT fields, updated_at FROM partner_profiles
        WHERE owner_user_id = ${user.id} AND partner_user_id = ${partner.id}
        LIMIT 1
      `;
      return send(res, 200, {
        ok: true,
        partner: { id: partner.id, name: partner.name },
        fields: rows[0] ? sanitizeFields(rows[0].fields) : null,
        updated_at: rows[0]?.updated_at ? new Date(rows[0].updated_at).toISOString() : null,
      });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST' });
    if (!partner) return send(res, 400, { ok: false, error: 'Сначала подключите партнёра к ящику.' });
    const body = await readJson(req);
    if (!Array.isArray(body.fields)) return send(res, 400, { ok: false, error: 'Не удалось прочитать карточку партнёра.' });
    const fields = sanitizeFields(body.fields);
    await db`
      INSERT INTO partner_profiles (pair_id, owner_user_id, partner_user_id, fields, updated_at)
      VALUES (${user.pair_id}, ${user.id}, ${partner.id}, ${JSON.stringify(fields)}::jsonb, NOW())
      ON CONFLICT (owner_user_id, partner_user_id) DO UPDATE SET
        fields = EXCLUDED.fields,
        updated_at = NOW()
    `;
    return send(res, 200, { ok: true, partner: { id: partner.id, name: partner.name }, fields });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить карточку партнёра.' });
  }
}
