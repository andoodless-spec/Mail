import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';
import { IDEA_DEFAULTS, IDEA_KINDS, IDEA_PLACES } from '../lib/ideas.js';

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

function validPlace(value) {
  return IDEA_PLACES.has(value) ? value : null;
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);

    if (req.method === 'GET') {
      const kind = String(query.get('kind') || 'budget');
      const place = validPlace(String(query.get('place') || 'inside'));
      if (!IDEA_KINDS.has(kind) || !place) return send(res, 400, { ok: false, error: 'Неизвестная категория свидания.' });
      const custom = await db`
        SELECT id, body, kind, place, author_id, created_at
        FROM ideas
        WHERE pair_id = ${user.pair_id} AND kind = ${kind} AND place = ${place} AND deleted_at IS NULL AND hidden_default = FALSE
        ORDER BY created_at DESC
      `;
      if (query.get('list') === '1') {
        return send(res, 200, { ok: true, ideas: custom.map((idea) => ({ id: idea.id, text: idea.body, kind: idea.kind, place: idea.place, mine: idea.author_id === user.id })) });
      }
      const hidden = await db`
        SELECT body FROM ideas
        WHERE pair_id = ${user.pair_id} AND kind = ${kind} AND place = ${place} AND deleted_at IS NULL AND hidden_default = TRUE
      `;
      const hiddenTexts = new Set(hidden.map((idea) => idea.body));
      const pool = [
        ...IDEA_DEFAULTS[kind][place].filter((text) => !hiddenTexts.has(text)).map((text) => ({ text, kind, place, custom: false })),
        ...custom.map((idea) => ({ id: idea.id, text: idea.body, kind: idea.kind, place: idea.place, custom: true })),
      ];
      const idea = pool[Math.floor(Math.random() * pool.length)] || null;
      return send(res, 200, { ok: true, idea });
    }

    if (req.method === 'POST') {
      const { kind, place: rawPlace, text, hidden } = await readJson(req);
      const cleanKind = String(kind || '').trim();
      const place = validPlace(String(rawPlace || ''));
      const cleanText = String(text || '').trim();
      if (!IDEA_KINDS.has(cleanKind) || !place) return send(res, 400, { ok: false, error: 'Выбери категорию и место для свидания.' });
      if (cleanText.length < 3 || cleanText.length > 300) return send(res, 400, { ok: false, error: 'Идея должна быть от 3 до 300 символов.' });
      if (hidden) {
        await db`UPDATE ideas SET deleted_at = NOW() WHERE pair_id = ${user.pair_id} AND kind = ${cleanKind} AND place = ${place} AND body = ${cleanText} AND hidden_default = FALSE AND deleted_at IS NULL`;
        await db`INSERT INTO ideas (pair_id, author_id, kind, place, body, hidden_default) VALUES (${user.pair_id}, ${user.id}, ${cleanKind}, ${place}, ${cleanText}, TRUE)`;
        return send(res, 200, { ok: true, hidden: true });
      }
      const rows = await db`
        INSERT INTO ideas (pair_id, author_id, kind, place, body, hidden_default)
        VALUES (${user.pair_id}, ${user.id}, ${cleanKind}, ${place}, ${cleanText}, FALSE)
        RETURNING id, body, kind, place
      `;
      return send(res, 200, { ok: true, idea: { id: rows[0].id, text: rows[0].body, kind: rows[0].kind, place: rows[0].place } });
    }

    if (req.method === 'DELETE') {
      const id = Number(query.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти идею.' });
      await db`UPDATE ideas SET deleted_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id} AND author_id = ${user.id} AND hidden_default = FALSE AND deleted_at IS NULL`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось загрузить идеи.' });
  }
}
