import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';

function queryOf(req) {
  return new URL(req.url || '/', 'https://quiet-mailbox.local').searchParams;
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });
    const query = queryOf(req);

    if (req.method === 'GET') {
      const rows = await db`
        SELECT id, body, created_at, source_note_id
        FROM capsule_entries
        WHERE pair_id = ${user.pair_id} AND user_id = ${user.id} AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      if (query.get('draw') === '1') {
        const item = rows[Math.floor(Math.random() * rows.length)] || null;
        return send(res, 200, { ok: true, entry: item ? { id: item.id, text: item.body, created_at: new Date(item.created_at).toISOString() } : null });
      }
      return send(res, 200, { ok: true, entries: rows.map((item) => ({ id: item.id, text: item.body, created_at: new Date(item.created_at).toISOString(), source_note_id: item.source_note_id })) });
    }

    if (req.method === 'POST') {
      const { body, text: legacyText, source_note_id: sourceId } = await readJson(req);
      const text = String(body ?? legacyText ?? '').trim();
      const hasSource = sourceId !== undefined && sourceId !== null && String(sourceId).trim() !== '';
      const sourceNoteId = hasSource ? Number(sourceId) : null;
      if (text.length < 2 || text.length > 3500) return send(res, 400, { ok: false, error: 'Запись должна быть от 2 до 3500 символов.' });
      if (hasSource && (!Number.isInteger(sourceNoteId) || sourceNoteId < 1)) return send(res, 400, { ok: false, error: 'Не удалось связать запись со сладостью.' });
      if (sourceNoteId) {
        const source = await db`SELECT id FROM notes WHERE id = ${sourceNoteId} AND pair_id = ${user.pair_id} AND category = 'sweet' LIMIT 1`;
        if (!source[0]) return send(res, 404, { ok: false, error: 'Сладость уже недоступна.' });
        const existing = await db`SELECT id FROM capsule_entries WHERE pair_id = ${user.pair_id} AND user_id = ${user.id} AND source_note_id = ${sourceNoteId} AND deleted_at IS NULL LIMIT 1`;
        if (existing[0]) return send(res, 200, { ok: true, id: existing[0].id });
        // Older deployments had a unique constraint without deleted_at. Reuse a
        // previously removed entry so saving the same sweet again cannot fail.
        const archived = await db`SELECT id FROM capsule_entries WHERE pair_id = ${user.pair_id} AND user_id = ${user.id} AND source_note_id = ${sourceNoteId} AND deleted_at IS NOT NULL ORDER BY id DESC LIMIT 1`;
        if (archived[0]) {
          await db`UPDATE capsule_entries SET body = ${text}, deleted_at = NULL WHERE id = ${archived[0].id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}`;
          return send(res, 200, { ok: true, id: archived[0].id });
        }
      }
      const rows = await db`
        INSERT INTO capsule_entries (pair_id, user_id, source_note_id, body)
        VALUES (${user.pair_id}, ${user.id}, ${sourceNoteId}, ${text})
        RETURNING id
      `;
      return send(res, 200, { ok: true, id: rows[0].id });
    }

    if (req.method === 'DELETE') {
      const id = Number(query.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { ok: false, error: 'Не удалось найти запись.' });
      await db`UPDATE capsule_entries SET deleted_at = NOW() WHERE id = ${id} AND pair_id = ${user.pair_id} AND user_id = ${user.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST, DELETE' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: 'Не удалось открыть капсулу тепла.' });
  }
}
