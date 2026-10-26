import { ensureSchema } from '../lib/db.js';
import { currentUser, readJson, send } from '../lib/http.js';
import { applyClassicMove, normalizeClassicTttState, sanitizeTruthRoundForUser } from '../lib/games.js';

async function getPairGameState(db, pairId, gameKey, fallback) {
  const rows = await db`
    SELECT state FROM pair_games_state
    WHERE pair_id = ${pairId} AND game_key = ${gameKey}
    LIMIT 1
  `;
  if (!rows[0] || !rows[0].state) return fallback;
  return typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
}

async function savePairGameState(db, pairId, gameKey, state) {
  await db`
    INSERT INTO pair_games_state (pair_id, game_key, state, updated_at)
    VALUES (${pairId}, ${gameKey}, ${JSON.stringify(state)}::jsonb, NOW())
    ON CONFLICT (pair_id, game_key) DO UPDATE SET
      state = EXCLUDED.state,
      updated_at = NOW()
  `;
  return state;
}

async function buildGamesResponse(db, user) {
  const members = await db`SELECT id, name FROM users WHERE pair_id = ${user.pair_id} ORDER BY id`;
  const partner = members.find((m) => Number(m.id) !== Number(user.id)) || null;

  const truthsState = await getPairGameState(db, user.pair_id, 'truths', { rounds: [], scores: {} });
  const runnerState = await getPairGameState(db, user.pair_id, 'runner', { records: {} });
  const rawTttState = await getPairGameState(db, user.pair_id, 'tictactoe', {
    catMoves: [],
    heartMoves: [],
    turn: 'cat',
    winner: null,
    draw: false,
    winLine: null,
    scores: { cat: 0, heart: 0 },
  });
  const tttState = normalizeClassicTttState(rawTttState);
  // Stable sides let each signed-in person see their own total on the left.
  const catUserId = Number(members[0]?.id || user.id);
  const myTttSide = Number(user.id) === catUserId ? 'cat' : 'heart';

  const rounds = Array.isArray(truthsState.rounds) ? truthsState.rounds : [];
  const scores = truthsState.scores || {};
  const records = runnerState.records || {};

  return {
    ok: true,
    user: { id: user.id, name: user.name },
    partner: partner ? { id: partner.id, name: partner.name } : null,
    truths: {
      rounds: rounds.slice(0, 30).map((r) => sanitizeTruthRoundForUser(r, user.id)),
      scores: {
        mine: Number(scores[String(user.id)] || 0),
        partner: partner ? Number(scores[String(partner.id)] || 0) : 0,
      },
    },
    runner: {
      mine: records[String(user.id)] || null,
      partner: partner ? (records[String(partner.id)] || null) : null,
    },
    tictactoe: {
      catMoves: Array.isArray(tttState.catMoves) ? tttState.catMoves : [],
      heartMoves: Array.isArray(tttState.heartMoves) ? tttState.heartMoves : [],
      turn: tttState.turn === 'heart' ? 'heart' : 'cat',
      winner: tttState.winner || null,
      draw: Boolean(tttState.draw),
      winLine: tttState.winLine || null,
      scores: {
        cat: Number(tttState.scores?.cat || 0),
        heart: Number(tttState.scores?.heart || 0),
      },
      my_side: myTttSide,
      partner_side: myTttSide === 'cat' ? 'heart' : 'cat',
    },
  };
}

export default async function handler(req, res) {
  try {
    const db = await ensureSchema();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { ok: false, error: 'Сначала войдите в свой ящик.' });

    if (req.method === 'GET') {
      return send(res, 200, await buildGamesResponse(db, user));
    }

    if (req.method === 'POST') {
      const data = await readJson(req);
      const action = String(data.action || '');

      if (action === 'truths_create') {
        const truth1 = String(data.truth1 || '').trim();
        const truth2 = String(data.truth2 || '').trim();
        const dream = String(data.dream || '').trim();
        if (truth1.length < 2 || truth2.length < 2 || dream.length < 2) {
          return send(res, 400, { ok: false, error: 'Заполни обе правды и мечту (минимум по 2 символа).' });
        }
        if (truth1.length > 350 || truth2.length > 350 || dream.length > 350) {
          return send(res, 400, { ok: false, error: 'Каждое утверждение должно быть до 350 символов.' });
        }

        const tagged = [
          { text: truth1, isDream: false },
          { text: truth2, isDream: false },
          { text: dream, isDream: true },
        ];
        for (let i = tagged.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
        }
        const dreamIndex = tagged.findIndex((item) => item.isDream);
        const truthsState = await getPairGameState(db, user.pair_id, 'truths', { rounds: [], scores: {} });
        truthsState.rounds = Array.isArray(truthsState.rounds) ? truthsState.rounds : [];
        truthsState.scores = truthsState.scores || {};

        const newRound = {
          id: Date.now(),
          author_id: Number(user.id),
          author_name: user.name,
          options: tagged.map((item) => item.text),
          dream_index: dreamIndex,
          created_at: new Date().toISOString(),
          completed_at: null,
          guesser_id: null,
          guesser_name: null,
          guessed_index: null,
          is_correct: null,
        };
        truthsState.rounds.unshift(newRound);
        truthsState.rounds = truthsState.rounds.slice(0, 40);
        await savePairGameState(db, user.pair_id, 'truths', truthsState);
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'truths_guess') {
        const roundId = Number(data.round_id);
        const guessedIndex = Number(data.guessed_index);
        if (!Number.isInteger(guessedIndex) || guessedIndex < 0 || guessedIndex > 2) {
          return send(res, 400, { ok: false, error: 'Выбери карточку, в которой спрятана мечта.' });
        }
        const truthsState = await getPairGameState(db, user.pair_id, 'truths', { rounds: [], scores: {} });
        const rounds = Array.isArray(truthsState.rounds) ? truthsState.rounds : [];
        const round = rounds.find((item) => Number(item.id) === roundId);
        if (!round) {
          return send(res, 400, { ok: false, error: 'Раунд не найден.' });
        }
        if (round.completed_at) {
          return send(res, 400, { ok: false, error: 'Этот раунд уже разгадан.' });
        }
        round.guessed_index = guessedIndex;
        round.guesser_id = Number(user.id);
        round.guesser_name = user.name;
        round.is_correct = guessedIndex === Number(round.dream_index);
        round.completed_at = new Date().toISOString();
        truthsState.scores = truthsState.scores || {};
        if (round.is_correct) {
          const key = String(user.id);
          truthsState.scores[key] = Number(truthsState.scores[key] || 0) + 1;
        }
        await savePairGameState(db, user.pair_id, 'truths', truthsState);
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'truths_delete') {
        const roundId = Number(data.round_id);
        const truthsState = await getPairGameState(db, user.pair_id, 'truths', { rounds: [], scores: {} });
        truthsState.rounds = (truthsState.rounds || []).filter((item) => Number(item.id) !== roundId);
        await savePairGameState(db, user.pair_id, 'truths', truthsState);
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'truths_reset') {
        await savePairGameState(db, user.pair_id, 'truths', { rounds: [], scores: {} });
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'runner_score') {
        const score = Math.max(0, Math.round(Number(data.score || 0)));
        const runnerState = await getPairGameState(db, user.pair_id, 'runner', { records: {} });
        runnerState.records = runnerState.records || {};
        const key = String(user.id);
        const prev = runnerState.records[key] || { best_score: 0 };
        runnerState.records[key] = {
          name: user.name,
          best_score: Math.max(Number(prev.best_score || 0), score),
          updated_at: new Date().toISOString(),
        };
        await savePairGameState(db, user.pair_id, 'runner', runnerState);
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'ttt_move') {
        const rawTttState = await getPairGameState(db, user.pair_id, 'tictactoe', {
          catMoves: [],
          heartMoves: [],
          turn: 'cat',
          winner: null,
          draw: false,
          winLine: null,
          scores: { cat: 0, heart: 0 },
        });
        const tttState = normalizeClassicTttState(rawTttState);
        const members = await db`SELECT id FROM users WHERE pair_id = ${user.pair_id} ORDER BY id`;
        const catUserId = Number(members[0]?.id || user.id);
        const side = Number(user.id) === catUserId ? 'cat' : 'heart';
        if (tttState.winner || tttState.draw) return send(res, 400, { ok: false, error: 'Партия завершена. Начните новую.' });
        if (tttState.turn !== side) return send(res, 400, { ok: false, error: 'Сейчас ход соперника.' });
        const next = applyClassicMove(tttState, side, data.cell);
        const scores = {
          cat: Number(tttState.scores?.cat || 0) + (next.winner === 'cat' ? 1 : 0),
          heart: Number(tttState.scores?.heart || 0) + (next.winner === 'heart' ? 1 : 0),
        };
        await savePairGameState(db, user.pair_id, 'tictactoe', { ...next, scores });
        return send(res, 200, await buildGamesResponse(db, user));
      }

      if (action === 'ttt_reset') {
        const rawTttState = await getPairGameState(db, user.pair_id, 'tictactoe', {
          catMoves: [], heartMoves: [], turn: 'cat', winner: null, draw: false, winLine: null, scores: { cat: 0, heart: 0 },
        });
        const tttState = normalizeClassicTttState(rawTttState);
        await savePairGameState(db, user.pair_id, 'tictactoe', {
          catMoves: [],
          heartMoves: [],
          turn: data.next_turn === 'heart' ? 'heart' : 'cat',
          winner: null,
          draw: false,
          winLine: null,
          scores: tttState.scores || { cat: 0, heart: 0 },
        });
        return send(res, 200, await buildGamesResponse(db, user));
      }

      return send(res, 400, { ok: false, error: 'Неизвестное действие игры.' });
    }

    return send(res, 405, { ok: false, error: 'Метод не поддерживается.' }, { Allow: 'GET, POST' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, error: error.message || 'Не удалось открыть игру. Попробуйте ещё раз.' });
  }
}
