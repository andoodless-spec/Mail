import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

function normalizeKind(value) {
  return value === 'intimate' ? 'intimate' : 'general';
}

function wishData(row, mine = false) {
  return {
    id: Number(row.id),
    kind: normalizeKind(row.kind),
    text: row.body,
    is_hidden: Boolean(row.is_hidden),
    received: Boolean(row.received),
    mine,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);
    const kind = normalizeKind(query.get('kind'));

    if (req.method === 'GET') {
      const rows = await db`
        SELECT w.id, w.kind, w.body, w.is_hidden, w.received, w.user_id, w.created_at, w.updated_at, u.name
        FROM wishes w
        JOIN users u ON u.id = w.user_id
        WHERE w.pair_id = ${user.pair_id} AND w.kind = ${kind}
        ORDER BY w.updated_at DESC, w.id DESC
      `;
      const members = await db`
        SELECT name FROM users WHERE pair_id = ${user.pair_id} AND id <> ${user.id} LIMIT 1
      `;
      const mine = rows.filter((row) => Number(row.user_id) === Number(user.id));
      const partner = rows.filter((row) => Number(row.user_id) !== Number(user.id) && !row.is_hidden);
      const hiddenCount = rows.filter((row) => Number(row.user_id) !== Number(user.id) && row.is_hidden).length;
      return send(res, 200, {
        ok: true,
        kind,
        mine_name: user.name,
        partner_name: members[0]?.name || rows.find((row) => Number(row.user_id) !== Number(user.id))?.name || 'Партнёр',
        mine: mine.map((row) => wishData(row, true)),
        partner: partner.map((row) => wishData(row, false)),
        partner_hidden_count: hiddenCount,
      });
    }

    if (req.method === 'POST') {
      const data = await readJson(req);
      const requestedKind = normalizeKind(data.kind);
      if (requestedKind !== kind) return send(res, 400, { ok: false, error: 'Не удалось определить список желаний.' });
      const text = String(data.text || '').trim();
      if (text.length < 3 || text.length > 500) return send(res, 400, { ok: false, error: 'Желание должно быть от 3 до 500 символов.' });
      const rows = await db`
        INSERT INTO wishes (pair_id, user_id, kind, body, is_hidden)
        VALUES (${user.pair_id}, ${user.id}, ${kind}, ${text}, ${kind === 'intimate'})
        RETURNING id
      `;
      return send(res, 200, { ok: true, id: rows[0].id });
    }

    const id = Number(query.get('id'));
    if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти желание.' });

    if (req.method === 'PATCH') {
      const data = await readJson(req);
      if (typeof data.is_hidden !== 'boolean' && typeof data.received !== 'boolean') {
        return send(res, 400, { ok: false, error: 'Не удалось изменить желание.' });
      }
      const rows = await db`
        SELECT id, is_hidden, received
        FROM wishes
        WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}
        LIMIT 1
      `;
      if (!rows[0]) return send(res, 403, { ok: false, error: 'Можно менять только свои желания.' });
      const isHidden = typeof data.is_hidden === 'boolean' ? data.is_hidden : Boolean(rows[0].is_hidden);
      const received = typeof data.received === 'boolean' ? data.received : Boolean(rows[0].received);
      await db`
        UPDATE wishes
        SET is_hidden = ${isHidden}, received = ${received}, updated_at = NOW()
        WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}
      `;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await db`DELETE FROM wishes WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось обновить лист желаний.' });
  }
}
