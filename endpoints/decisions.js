import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';
import { DECISION_DEFAULTS, DECISION_TYPES, decisionType, decisionTypes } from '../lib/decisions.js';

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

function builtinOptions(kinds, hidden = new Set()) {
  return kinds.flatMap((kind) => (DECISION_DEFAULTS[kind] || []).map((text, index) => ({
    id: `builtin:${kind}:${index}`,
    text,
    kind,
    builtin: true,
  })).filter((item) => !hidden.has(item.id)));
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);

    if (req.method === 'GET') {
      const requestedKind = query.get('kind');
      const kind = requestedKind ? decisionType(requestedKind) : null;
      if (requestedKind && !kind) return send(res, 400, { ok: false, error: 'Неизвестный тип решения.' });
      const kinds = kind ? [kind] : DECISION_TYPES.map((item) => item.key);
      const hiddenRows = await db`
        SELECT builtin_key
        FROM decision_hidden_builtins
        WHERE pair_id = ${user.pair_id}
      `;
      const hidden = new Set(hiddenRows.map((item) => item.builtin_key));
      const rows = await db`
        SELECT id, body, kind, user_id, created_at
        FROM decision_options
        WHERE pair_id = ${user.pair_id} AND deleted_at IS NULL
        ORDER BY created_at
      `;
      const custom = rows
        .map((item) => ({ ...item, normalized_kind: decisionType(item.kind) || DECISION_TYPES[0].key }))
        .filter((item) => kinds.includes(item.normalized_kind))
        .map((item) => ({ id: item.id, text: item.body, kind: item.normalized_kind, builtin: false, mine: item.user_id === user.id }));
      return send(res, 200, { ok: true, types: decisionTypes(), options: [...builtinOptions(kinds, hidden), ...custom] });
    }

    if (req.method === 'POST') {
      const data = await readJson(req);
      const kind = decisionType(data.kind);
      if (!kind) return send(res, 400, { ok: false, error: 'Выбери тип решения.' });

      if (data.action === 'choose') {
        const hiddenRows = await db`
          SELECT builtin_key
          FROM decision_hidden_builtins
          WHERE pair_id = ${user.pair_id}
        `;
        const hidden = new Set(hiddenRows.map((item) => item.builtin_key));
        const rows = await db`
          SELECT id, body, kind, user_id
          FROM decision_options
          WHERE pair_id = ${user.pair_id} AND COALESCE(NULLIF(kind, 'general'), 'food') = ${kind} AND deleted_at IS NULL
          ORDER BY created_at
        `;
        const options = [
          ...builtinOptions([kind], hidden),
          ...rows.map((item) => ({ id: item.id, text: item.body, kind, builtin: false, mine: item.user_id === user.id })),
        ];
        const choice = options[Math.floor(Math.random() * options.length)] || null;
        return send(res, 200, { ok: true, problem: null, choice, options, type: DECISION_TYPES.find((item) => item.key === kind) });
      }

      const body = String(data.text || '').trim();
      if (body.length < 2 || body.length > 300) return send(res, 400, { ok: false, error: 'Вариант должен быть от 2 до 300 символов.' });
      const rows = await db`
        INSERT INTO decision_options (pair_id, user_id, kind, body)
        VALUES (${user.pair_id}, ${user.id}, ${kind}, ${body})
        RETURNING id
      `;
      return send(res, 200, { ok: true, id: rows[0].id, kind });
    }

    if (req.method === 'DELETE') {
      const rawId = query.get('id') || '';
      if (rawId.startsWith('builtin:')) {
        const match = rawId.match(/^builtin:(food|movie|date|activity|game|drink):(\d+)$/);
        if (!match || Number(match[2]) >= (DECISION_DEFAULTS[match[1]] || []).length) return send(res, 400, { ok: false, error: 'Не удалось найти встроенный вариант.' });
        await db`
          INSERT INTO decision_hidden_builtins (pair_id, user_id, builtin_key)
          VALUES (${user.pair_id}, ${user.id}, ${rawId})
          ON CONFLICT (pair_id, builtin_key) DO NOTHING
        `;
        return send(res, 200, { ok: true });
      }
      const id = Number(rawId);
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти ваш вариант.' });
      await db`UPDATE decision_options SET deleted_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id} AND deleted_at IS NULL`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось сохранить варианты для котика.' });
  }
}
