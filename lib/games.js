export const GAME_TABS = {
  truths: 'Две правды и мечта',
  runner: 'Любимое село',
  tictactoe: 'Крестики-нолики',
};

export const TRUTH_TOPIC_HINTS = [
  'Первые три часа нашей следующей встречи',
  'Забавный факт обо мне, о котором мы ещё не говорили',
  'Что я чувствую во время наших ночных созвонов (+2 часа)',
  'Маленькая деталь в тебе, от которой я всегда улыбаюсь',
  'Необычное место в Питере или Тюмени, куда хочется пойти вдвоём',
  'Что обязательно будет в нашем идеальном совместном выходном',
  'Смешная мысль, которая приходила мне в голову при взгляде на твоё фото',
  'Что я хочу сделать в первую минуту, когда обниму тебя в аэропорту',
];

export const RUNNER_LEGEND = {
  lifeCount: 1,
  runner: { image: '/assets/runner-cow.svg', title: 'Коровка' },
  obstacles: [
    { key: 'rock', image: '/assets/runner-rock.svg', title: 'Камень', hint: 'Перепрыгивай' },
    { key: 'tree', image: '/assets/runner-tree.svg', title: 'Пиксельное дерево', hint: 'Нужен двойной прыжок' },
    { key: 'bull', image: '/assets/runner-bull.svg', title: 'Бычок', hint: 'Перепрыгивай' },
  ],
  bonuses: [
    { key: 'grass', image: '/assets/runner-grass.svg', title: 'Травка', points: 60, hint: '+60 очков' },
    { key: 'milk', image: '/assets/runner-milk.svg', title: 'Молоко', points: 100, hint: '+100 очков' },
    { key: 'boots', image: '/assets/runner-boots.svg', title: 'Ботинки', points: 80, hint: 'Выше прыжок' },
  ],
};

export const TICTACTOE_PHRASES = {
  catWin: 'Победа за Яночкин! С Саняни — поцелуйчик при встрече',
  heartWin: 'Победа за Саняней! С Яночкин — обнимашки при встрече',
  draw: 'Ничья — поле заполнено.',
};

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function checkTicTacToeWinner(catMoves = [], heartMoves = []) {
  const catSet = new Set(catMoves);
  const heartSet = new Set(heartMoves);
  for (const line of WIN_LINES) {
    if (line.every((cell) => catSet.has(cell))) return { winner: 'cat', line };
    if (line.every((cell) => heartSet.has(cell))) return { winner: 'heart', line };
  }
  return null;
}

export function normalizeClassicTttState(state = {}) {
  const validCells = (moves) => [...new Set((Array.isArray(moves) ? moves : []).map(Number).filter((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 8))];
  const catMoves = validCells(state.catMoves);
  const heartMoves = validCells(state.heartMoves).filter((cell) => !catMoves.includes(cell));
  const win = checkTicTacToeWinner(catMoves, heartMoves);
  const winner = win?.winner || null;
  return {
    catMoves,
    heartMoves,
    turn: state.turn === 'heart' ? 'heart' : 'cat',
    winner,
    draw: !winner && (catMoves.length + heartMoves.length >= 9),
    winLine: win?.line || null,
    scores: {
      cat: Number(state.scores?.cat || 0),
      heart: Number(state.scores?.heart || 0),
    },
  };
}

export function applyClassicMove(state, side, cellIndex) {
  const cell = Number(cellIndex);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    throw new Error('Выберите свободную клетку на поле.');
  }
  const current = normalizeClassicTttState(state);
  if (current.winner || current.draw) {
    throw new Error('Партия уже завершена. Начните новую.');
  }
  if (current.catMoves.includes(cell) || current.heartMoves.includes(cell)) {
    throw new Error('Эта клетка уже занята.');
  }
  const catMoves = [...current.catMoves];
  const heartMoves = [...current.heartMoves];
  (side === 'heart' ? heartMoves : catMoves).push(cell);
  const win = checkTicTacToeWinner(catMoves, heartMoves);
  const draw = !win && catMoves.length + heartMoves.length === 9;
  return {
    catMoves,
    heartMoves,
    turn: (win || draw) ? side : (side === 'cat' ? 'heart' : 'cat'),
    winner: win?.winner || null,
    draw,
    winLine: win?.line || null,
  };
}

export function sanitizeTruthRoundForUser(round, userId) {
  const isAuthor = Number(round.author_id) === Number(userId);
  const isCompleted = Boolean(round.completed_at);
  return {
    id: round.id,
    author_id: Number(round.author_id),
    author_name: round.author_name || 'Партнёр',
    is_author: isAuthor,
    options: round.options,
    created_at: round.created_at,
    completed_at: round.completed_at || null,
    guesser_name: round.guesser_name || null,
    guessed_index: isCompleted ? Number(round.guessed_index) : null,
    dream_index: (isCompleted || isAuthor) ? Number(round.dream_index) : null,
    is_correct: isCompleted ? Boolean(round.is_correct) : null,
  };
}
