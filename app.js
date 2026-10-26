const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let appState = null;
let selectedCategory = 'sweet';
let activeView = 'mailbox';
let lastReminderKey = null;
let homeworkState = null;
const homeworkDrafts = new Map();
let selectedDateIdea = null;
let selectedDateKind = null;
let selectedDatePlace = null;
let gamePollTimer = null;
let personalizationDraft = null;
let partnerProfileData = null;
let partnerProfileEditing = false;

const PERSONAL_THEME_KEYS = ['white', 'pink', 'purple', 'blue', 'yellow', 'cyan'];
const THEME_LABELS = {
  white: 'Белая', pink: 'Розовая', purple: 'Фиолетовая', blue: 'Синяя', yellow: 'Жёлтая', cyan: 'Голубая',
};
const THEME_BROWSER_COLORS = {
  white: '#fffdfa', pink: '#ffedf5', purple: '#fbf8ff', blue: '#f7fbff', yellow: '#fffdf5', cyan: '#f5ffff',
};
const TAB_ORDER_DEFAULTS = {
  main: ['mailbox', 'dates', 'our', 'games'],
  mailbox: ['mailbox', 'conversation', 'homework', 'capsule'],
  games: ['truths', 'runner', 'tictactoe'],
  dates: ['random', 'successful'],
};
const TAB_ORDER_LABELS = {
  main: { mailbox: 'Ящик', dates: 'Свидания', our: 'Наше', games: 'Игры' },
  mailbox: { mailbox: 'Ящик', conversation: 'Разговор', homework: 'Домашнее', capsule: 'Капсула' },
  games: { truths: 'Две правды', runner: 'Любимое село', tictactoe: 'Крестики' },
  dates: { random: 'Случайная идея', successful: 'Удавшиеся' },
};
const TAB_ORDER_TITLES = { main: 'Основные вкладки', mailbox: 'Вкладки «Ящика»', games: 'Игры', dates: 'Вкладки свиданий' };
const PARTNER_PROFILE_ACCENTS = {
  theme: 'По теме',
  rose: 'Розовый',
  lilac: 'Лиловый',
  sky: 'Голубой',
  sage: 'Зелёный',
  sun: 'Тёплый',
};
const DEFAULT_PARTNER_PROFILE_FIELDS = [
  { id: 'favorite_color', label: 'Любимый цвет', value: '', accent: 'theme' },
  { id: 'birthday', label: 'День рождения', value: '', accent: 'theme' },
  { id: 'favorite_food', label: 'Любимое блюдо', value: '', accent: 'theme' },
  { id: 'favorite_music', label: 'Любимая музыка', value: '', accent: 'theme' },
  { id: 'occupation', label: 'Занятие / работа', value: '', accent: 'theme' },
  { id: 'car', label: 'Марка машины', value: '', accent: 'theme' },
];

function normalizePartnerProfileAccent(value) {
  const accent = String(value || 'theme');
  return Object.prototype.hasOwnProperty.call(PARTNER_PROFILE_ACCENTS, accent) ? accent : 'theme';
}

function normalizeTabOrder(value, fallback) {
  const supplied = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const next = [];
  supplied.forEach((item) => { if (fallback.includes(item) && !next.includes(item)) next.push(item); });
  fallback.forEach((item) => { if (!next.includes(item)) next.push(item); });
  return next;
}

function normalizeClientPreferences(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    theme: PERSONAL_THEME_KEYS.includes(raw.theme) ? raw.theme : 'pink',
    orders: Object.fromEntries(Object.entries(TAB_ORDER_DEFAULTS).map(([key, fallback]) => [key, normalizeTabOrder(raw.orders?.[key], fallback)])),
  };
}

const ENCOURAGEMENTS = {
  sweet: [
    'Как хорошо, что ты заметил(а) это. Сладкое тоже важно сохранять 💌',
    'Маленькая радость уже нашла своё место. Ты молодец, что поделился(ась).',
    'Пусть таких моментов станет побольше. Ящик бережно всё сохранит.',
  ],
  hard: [
    'Мы разберёмся вместе.',
    'Всё будет супер пупер, не переживай.',
    'Мы со всем справимся.',
  ],
  calm: [
    'Здесь можно быть честными. Даже маленький шаг уже считается.',
    'Котик-режим включён: без спешки, без оценок, с заботой.',
  ],
};

const encouragementCursor = { sweet: -1, hard: -1, calm: -1 };

const ACHIEVEMENT_LABELS = {
  first_share: 'Первый честный шаг',
  sweet_share: 'Сладость замечена',
  hard_share: 'Гадость названа',
  date_together: 'Вы нашли время друг для друга',
  date_try_again: 'Вы попробовали — в следующий раз будет лучше',
  talk_resolved: 'Вы нашли решение вместе',
  talk_kept_trying: 'Вы не бросили важный разговор',
};

const DEFAULT_DECISION_TYPES = [
  { key: 'food', label: 'Что поесть' },
  { key: 'movie', label: 'Что посмотреть' },
  { key: 'date', label: 'Куда сходить' },
  { key: 'activity', label: 'Чем заняться' },
  { key: 'game', label: 'Во что поиграть' },
  { key: 'drink', label: 'Что выпить' },
];

const DEFAULT_DECISIONS = {
  food: [
    'Приготовить вместе что-нибудь простое и вкусное.',
    'Заказать то, чего давно хотелось.',
    'Выбрать любимое блюдо одного из вас, а в следующий раз — другого.',
    'Устроить маленький пикник из того, что уже есть дома.',
    'Заказать два разных блюда и попробовать понемногу друг у друга.',
    'Выбрать блюдо по первой букве имени одного из вас.',
  ],
  movie: [
    'Посмотреть лёгкую комедию.',
    'Включить первую серию нового сериала.',
    'Пересмотреть фильм, который когда-то понравился вам обоим.',
    'Выбрать фильм по случайной букве алфавита.',
    'Посмотреть короткий документальный фильм и обсудить его.',
    'Устроить мини-кинотеатр: трейлеры, плед и общий рейтинг.',
  ],
  date: [
    'Взять кофе и отправиться на прогулку без маршрута.',
    'Устроить уютное свидание дома.',
    'Выбрать новое место в городе и исследовать его вместе.',
    'Сделать маленький спонтанный сюрприз друг для друга.',
    'Найти красивый маршрут и взять с собой любимый перекус.',
    'Сходить туда, где вы ещё ни разу не были вместе.',
  ],
  activity: [
    'Сыграть во что-нибудь вместе.',
    'Включить музыку и устроить домашний танцевальный перерыв.',
    'Пойти гулять и найти по одной красивой детали вокруг.',
    'Сделать вечер без телефонов и поговорить.',
    'Собрать маленький пазл или конструктор вместе.',
    'Приготовить друг другу мини-сюрприз за десять минут.',
  ],
  game: [
    'Достать настольную игру и сыграть короткую партию.',
    'Запустить кооперативную игру на компьютере.',
    'Выбрать игру на телефоне и устроить дружеский турнир.',
    'Сыграть в карточную игру, викторину или игру со словами.',
    'Запустить спокойную головоломку и решать её по очереди.',
    'Выбрать кооперативную игру, где вы играете за одну команду.',
  ],
  drink: [
    'Сделать чай, какао или кофе с чем-нибудь вкусным.',
    'Приготовить домашний лимонад или безалкогольный коктейль.',
    'Выбрать любимое вино, пиво или другой алкогольный напиток, если хочется именно этого.',
    'Смешать новый безалкогольный напиток из того, что есть дома.',
    'Устроить мини-дегустацию двух напитков и выбрать фаворита.',
    'Сделать тёплый сезонный напиток с пряностями.',
  ],
};

const DEFAULT_IDEAS = {
  budget: {
    outside: [
      'Взять кофе с собой и исследовать улицу, где вы ещё не гуляли.',
      'Устроить фотопрогулку: по десять смешных и красивых кадров друг для друга.',
      'Пойти гулять по району и выбрать друг другу по одной красивой детали.',
      'Взять плед, перекус из дома и устроить маленький пикник в парке.',
      'Пройтись по вечернему городу и выбрать друг другу по одному маленькому сюрпризу.',
    ],
    inside: [
      'Устроить домашний пикник на полу с пледом и тем, что уже есть в холодильнике.',
      'Приготовить вместе новое блюдо из трёх случайных продуктов дома.',
      'Сделать вечер настольных игр или карточек с телефонами на беззвучном.',
      'Устроить свидание «как в первом месяце»: любимая музыка, чай и разговор.',
      'Выбрать фильм по случайной букве и приготовить к нему смешные закуски.',
    ],
  },
  treat: {
    outside: [
      'Устроить день в новом городе: поезд, хороший ресторан и без спешки.',
      'Пойти на концерт, спектакль или стендап, который давно откладывали.',
      'Сделать фотосессию для двоих у фотографа или в красивой студии.',
      'Устроить гастрономический маршрут по трём местам, которые вы ещё не пробовали.',
      'Выбрать совместное впечатление: термы, картинг или прогулка на лодке.',
    ],
    inside: [
      'Снять уютный домик или номер на одну ночь и устроить маленький побег.',
      'Забронировать мастер-класс для двоих — керамика, свечи, танцы или кухня.',
      'Подарить друг другу день без бытовых дел с доставкой, фильмом и десертом.',
      'Устроить красивый поздний завтрак дома с букетом и любимой музыкой.',
      'Сделать домашний спа-вечер с масками, массажем и мягким светом.',
    ],
  },
};

const GAME_TABS = {
  truths: 'Две правды и мечта',
  runner: 'Любимое село',
  tictactoe: 'Крестики-нолики',
};

const TRUTH_TOPIC_HINTS = [
  'Первые три часа нашей следующей встречи',
  'Забавный факт обо мне, о котором мы ещё не говорили',
  'Что я чувствую во время наших ночных созвонов (+2 часа)',
  'Маленькая деталь в тебе, от которой я всегда улыбаюсь',
  'Необычное место в Питере или Тюмени, куда хочется пойти вдвоём',
  'Что обязательно будет в нашем идеальном совместном выходном',
  'Смешная мысль, которая приходила мне в голову при взгляде на твоё фото',
  'Что я хочу сделать в первую минуту, когда обниму тебя в аэропорту',
];

const TICTACTOE_PHRASES = {
  catWin: 'Победа за Яночкин! С Саняни — поцелуйчик при встрече',
  heartWin: 'Победа за Саняней! С Яночкин — обнимашки при встрече',
};

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkTicTacToeWinner(catMoves = [], heartMoves = []) {
  const catSet = new Set(catMoves);
  const heartSet = new Set(heartMoves);
  for (const line of WIN_LINES) {
    if (line.every((c) => catSet.has(c))) return { winner: 'cat', line };
    if (line.every((c) => heartSet.has(c))) return { winner: 'heart', line };
  }
  return null;
}

function normalizeClassicTttState(state = {}) {
  const validCells = (moves) => [...new Set((Array.isArray(moves) ? moves : []).map(Number).filter((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 8))];
  const catMoves = validCells(state.catMoves);
  const heartMoves = validCells(state.heartMoves).filter((cell) => !catMoves.includes(cell));
  const win = checkTicTacToeWinner(catMoves, heartMoves);
  return {
    catMoves,
    heartMoves,
    turn: state.turn === 'heart' ? 'heart' : 'cat',
    winner: win?.winner || null,
    draw: !win && catMoves.length + heartMoves.length >= 9,
    winLine: win?.line || null,
    scores: { cat: Number(state.scores?.cat || 0), heart: Number(state.scores?.heart || 0) },
  };
}

function applyClassicMove(state, side, cellIndex) {
  const cell = Number(cellIndex);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new Error('Выберите свободную клетку.');
  const current = normalizeClassicTttState(state);
  if (current.winner || current.draw) throw new Error('Партия завершена. Начните новую.');
  if (current.catMoves.includes(cell) || current.heartMoves.includes(cell)) throw new Error('Эта клетка уже занята.');
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

function sanitizeTruthRoundForUser(round, userId) {
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

function localStore() {
  const key = 'quiet_mailbox_demo';
  let store = null;
  try { store = JSON.parse(localStorage.getItem(key) || 'null'); } catch { store = null; }
  store = store || { pair: null, users: [], notes: [], ideas: [], achievements: [] };
  store.users ||= [];
  store.notes ||= [];
  store.ideas ||= [];
  store.achievements ||= [];
  store.outcomes ||= [];
  store.dateHistory ||= [];
  store.homeworkCases ||= [];
  store.homeworkAnswers ||= [];
  store.capsule ||= [];
  store.agreements ||= [];
  store.decisions ||= [];
  store.decisionHidden ||= [];
  store.wins ||= [];
  store.feedback ||= [];
  store.gameRounds ||= [];
  store.gameAnswers ||= [];
  store.wishes ||= [];
  store.anniversaryIdeas ||= [];
  store.partnerProfiles ||= [];
  store.users.forEach((member) => { member.preferences = normalizeClientPreferences(member.preferences); });
  store.truthsState ||= { rounds: [], scores: {} };
  store.runnerState ||= { records: {} };
  store.tttState = normalizeClassicTttState(store.tttState || { catMoves: [], heartMoves: [], turn: 'cat', winner: null, draw: false, winLine: null, scores: { cat: 0, heart: 0 } });
  return store;
}

function saveLocalStore(store) {
  localStorage.setItem('quiet_mailbox_demo', JSON.stringify(store));
  return store;
}

function localPayload(options) {
  try { return JSON.parse(options?.body || '{}'); } catch { return {}; }
}

function localDateKeyNow() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKey(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localState(store) {
  const userId = Number(localStorage.getItem('quiet_mailbox_user') || 0);
  const user = store.users.find((item) => item.id === userId);
  if (!user || !store.pair) throw new Error('Сначала войдите в свой ящик.');
  const partner = store.users.find((item) => item.id !== user.id) || null;
  const notes = store.notes.filter((item) => item.pair_id === store.pair.id);
  const opened = Boolean(store.pair.opened_at);
  const scheduled = store.pair.scheduled_date || store.pair.scheduled_for;
  const canOpen = Boolean(scheduled && !opened && (store.pair.scheduled_date ? dateKey(scheduled) <= localDateKeyNow() : new Date(scheduled).getTime() <= Date.now()));
  const ownNotes = notes.filter((item) => item.author_id === user.id);
  return {
    ok: true,
    user: { id: user.id, name: user.name },
    partner,
    preferences: normalizeClientPreferences(user.preferences),
    pair_code: store.pair.code,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
    pin_set: Boolean(user.pin),
    scheduled_date: dateKey(scheduled),
    scheduled_for: dateKey(scheduled),
    opened,
    can_open: canOpen,
    nudge_enabled: store.pair.nudge_enabled,
    last_note_at: ownNotes.length ? ownNotes[ownNotes.length - 1].created_at : null,
    counts: {
      sweet: ownNotes.filter((item) => item.category === 'sweet').length,
      hard: ownNotes.filter((item) => item.category === 'hard').length,
    },
    achievements: store.achievements.filter((item) => item.user_id === user.id),
    latest_outcome: store.outcomes.filter((item) => item.pair_id === store.pair.id).slice(-1)[0] || null,
    notes: opened ? notes.map((item) => ({ ...item, author: store.users.find((u) => u.id === item.author_id)?.name || 'Автор' })) : [],
  };
}

function requireLocalUser(store) {
  const userId = Number(localStorage.getItem('quiet_mailbox_user') || 0);
  const user = store.users.find((item) => item.id === userId);
  if (!user || !store.pair) throw new Error('Сначала войдите в свой ящик.');
  return user;
}

async function localApi(path, options = {}) {
  const url = new URL(path, 'https://quiet-mailbox.local');
  const route = url.pathname;
  const store = localStore();
  const data = localPayload(options);
  const method = options.method || 'GET';

  if (route === '/api/create') {
    const name = String(data.name || '').trim();
    const pin = String(data.pin || '').trim();
    if (name.length < 2) throw new Error('Напиши имя или короткое обращение.');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN должен состоять из 4–8 цифр.');
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    store.pair = { id: 1, code, scheduled_date: null, scheduled_for: null, opened_at: null, nudge_enabled: true };
    store.users = [{ id: 1, name, pin }];
    store.notes = [];
    store.ideas = [];
    store.achievements = [];
    store.outcomes = [];
    store.dateHistory = [];
    store.homeworkCases = [];
    store.homeworkAnswers = [];
    store.capsule = [];
    store.agreements = [];
    store.decisions = [];
    store.wins = [];
    store.feedback = [];
    store.gameRounds = [];
    store.gameAnswers = [];
    store.wishes = [];
    store.anniversaryIdeas = [];
    store.partnerProfiles = [];
    store.users[0].preferences = normalizeClientPreferences();
    saveLocalStore(store);
    localStorage.setItem('quiet_mailbox_user', '1');
    return { ok: true, invite_code: code };
  }

  if (route === '/api/join') {
    const name = String(data.name || '').trim();
    const code = String(data.code || '').trim().toUpperCase();
    const pin = String(data.pin || '').trim();
    if (!store.pair || store.pair.code !== code) throw new Error('Такого кода нет.');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN должен состоять из 4–8 цифр.');
    if (store.users.length >= 2) throw new Error('В этом ящике уже два участника.');
    const id = Math.max(0, ...store.users.map((item) => item.id)) + 1;
    store.users.push({ id, name, pin, preferences: normalizeClientPreferences() });
    saveLocalStore(store);
    localStorage.setItem('quiet_mailbox_user', String(id));
    return { ok: true };
  }

  if (route === '/api/login') {
    const name = String(data.name || '').trim().toLowerCase();
    const code = String(data.code || '').trim().toUpperCase();
    const pin = String(data.pin || '').trim();
    const user = store.users.find((item) => item.name.toLowerCase() === name && item.pin === pin && (!code || store.pair?.code === code));
    if (!user) throw new Error('Имя или PIN не подошли.');
    saveLocalStore(store);
    localStorage.setItem('quiet_mailbox_user', String(user.id));
    return { ok: true };
  }

  if (route === '/api/logout') {
    localStorage.removeItem('quiet_mailbox_user');
    return { ok: true };
  }

  if (route === '/api/state') return localState(store);

  const user = requireLocalUser(store);
  const userId = user.id;

  if (route === '/api/preferences') {
    if (method === 'GET') return { ok: true, preferences: normalizeClientPreferences(user.preferences) };
    if (method !== 'POST') throw new Error('Метод персонализации не поддерживается.');
    const current = normalizeClientPreferences(user.preferences);
    const next = normalizeClientPreferences({
      theme: data.theme === undefined ? current.theme : data.theme,
      orders: { ...current.orders, ...(data.orders && typeof data.orders === 'object' ? data.orders : {}) },
    });
    user.preferences = next;
    saveLocalStore(store);
    return { ok: true, preferences: next };
  }

  if (route === '/api/partner-profile') {
    const partner = store.users.find((member) => member.id !== userId) || null;
    if (method === 'GET') {
      const entry = partner ? store.partnerProfiles.find((item) => item.owner_user_id === userId && item.partner_user_id === partner.id) : null;
      return { ok: true, partner: partner ? { id: partner.id, name: partner.name } : null, fields: entry?.fields || null, updated_at: entry?.updated_at || null };
    }
    if (method !== 'POST') throw new Error('Метод карточки партнёра не поддерживается.');
    if (!partner) throw new Error('Сначала подключите партнёра к ящику.');
    if (!Array.isArray(data.fields)) throw new Error('Не удалось прочитать карточку партнёра.');
    const fields = data.fields.slice(0, 24).map((field, index) => ({
      id: String(field?.id || `field_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `field_${index + 1}`,
      label: String(field?.label || '').trim().replace(/\s+/g, ' ').slice(0, 50),
      value: String(field?.value || '').trim().replace(/\s+/g, ' ').slice(0, 300),
      accent: normalizePartnerProfileAccent(field?.accent),
    })).filter((field) => field.label);
    const previousIndex = store.partnerProfiles.findIndex((item) => item.owner_user_id === userId && item.partner_user_id === partner.id);
    const entry = { owner_user_id: userId, partner_user_id: partner.id, fields, updated_at: new Date().toISOString() };
    if (previousIndex >= 0) store.partnerProfiles[previousIndex] = entry;
    else store.partnerProfiles.push(entry);
    saveLocalStore(store);
    return { ok: true, partner: { id: partner.id, name: partner.name }, fields };
  }

  if (route === '/api/pin') {
    const hasName = data.name !== undefined && String(data.name || '').trim() !== '';
    const hasPin = data.pin !== undefined && String(data.pin || '').trim() !== '';
    if (!hasName && !hasPin) throw new Error('Укажите новое имя профиля или новый пароль (PIN).');
    if (hasName) {
      const clean = String(data.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (clean.length < 2) throw new Error('Имя должно быть от 2 символов.');
      user.name = clean;
    }
    if (hasPin) {
      const pin = String(data.pin || '').trim();
      if (!/^\d{4,8}$/.test(pin)) throw new Error('Пароль (PIN) должен состоять из 4–8 цифр.');
      user.pin = pin;
    }
    saveLocalStore(store);
    return { ok: true, name: user.name };
  }

  if (route === '/api/notes') {
    if (store.pair.opened_at) throw new Error('Сначала завершите текущий цикл обсуждения.');
    if (!['sweet', 'hard'].includes(data.category)) throw new Error('Выбери категорию записи.');
    if (!data.body || String(data.body).trim().length > 3500) throw new Error('Текст должен быть от 1 до 3500 символов.');
    const body = String(data.body).trim();
    store.notes.push({ id: Date.now(), pair_id: store.pair.id, author_id: userId, category: data.category, body, created_at: new Date().toISOString() });
    const own = store.notes.filter((item) => item.author_id === userId);
    const unlocked = [];
    if (own.length === 1) unlocked.push('first_share');
    if (own.filter((item) => item.category === data.category).length === 1) unlocked.push(`${data.category}_share`);
    unlocked.forEach((kind) => {
      if (!store.achievements.some((item) => item.user_id === userId && item.kind === kind)) store.achievements.push({ user_id: userId, kind, created_at: new Date().toISOString() });
    });
    saveLocalStore(store);
    return { ok: true, achievement: unlocked[0] ? { kind: unlocked[0] } : null };
  }

  if (route === '/api/schedule') {
    const scheduledDate = String(data.scheduled_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || scheduledDate < localDateKeyNow()) throw new Error('Выбери сегодняшнюю или будущую дату.');
    store.pair.scheduled_date = scheduledDate;
    store.pair.scheduled_for = `${scheduledDate}T00:00:00.000Z`;
    store.pair.opened_at = null;
    saveLocalStore(store);
    return { ok: true, scheduled_date: scheduledDate };
  }

  if (route === '/api/open') {
    if (!data.now && (!store.pair.scheduled_date || store.pair.scheduled_date > localDateKeyNow())) throw new Error('День разговора ещё не наступил.');
    store.pair.opened_at = new Date().toISOString();
    saveLocalStore(store);
    return { ok: true };
  }

  if (route === '/api/finish') {
    if (!store.pair.opened_at) throw new Error('Записи ещё не открыты.');
    store.notes = [];
    store.outcomes = store.outcomes.filter((item) => item.pair_id !== store.pair.id);
    store.pair.scheduled_date = null;
    store.pair.scheduled_for = null;
    store.pair.opened_at = null;
    saveLocalStore(store);
    return { ok: true };
  }

  if (route === '/api/nudges') {
    store.pair.nudge_enabled = Boolean(data.enabled);
    saveLocalStore(store);
    return { ok: true };
  }

  if (route === '/api/outcome') {
    if (!['resolved', 'not_yet'].includes(data.result)) throw new Error('Выбери один из вариантов.');
    store.outcomes.push({ pair_id: store.pair.id, user_id: userId, result: data.result, created_at: new Date().toISOString() });
    const achievementKind = data.result === 'resolved' ? 'talk_resolved' : 'talk_kept_trying';
    store.users.forEach((member) => {
      if (!store.achievements.some((item) => item.user_id === member.id && item.kind === achievementKind)) store.achievements.push({ user_id: member.id, kind: achievementKind, created_at: new Date().toISOString() });
    });
    saveLocalStore(store);
    return { ok: true, result: data.result, achievement: { kind: achievementKind } };
  }

  if (route === '/api/date-history') {
    if (method === 'POST') {
      const idea = String(data.idea || '').trim();
      if (!['budget', 'treat'].includes(data.kind) || idea.length < 3) throw new Error('Не удалось сохранить историю свидания.');
      const entry = { id: Date.now(), pair_id: store.pair.id, user_id: userId, kind: data.kind, place: data.place || 'inside', idea, status: data.status, reason: String(data.reason || ''), alternative: String(data.alternative || ''), reflection: String(data.reflection || ''), repeat: data.repeat === true || data.repeat === 'yes', created_at: new Date().toISOString() };
      store.dateHistory.push(entry);
      const achievementKind = data.status === 'completed' ? 'date_together' : 'date_try_again';
      store.users.filter((member) => member.pair_id === store.pair.id || store.users.length <= 2).forEach((member) => {
        if (!store.achievements.some((item) => item.user_id === member.id && item.kind === achievementKind)) store.achievements.push({ user_id: member.id, kind: achievementKind, created_at: new Date().toISOString() });
      });
      saveLocalStore(store);
      return { ok: true, id: entry.id, achievement: { kind: achievementKind } };
    }
    return { ok: true, dates: store.dateHistory.filter((item) => item.pair_id === store.pair.id && item.status === 'completed').sort((a, b) => b.id - a.id) };
  }

  if (route === '/api/homework') {
    const getCases = () => store.homeworkCases.filter((item) => item.pair_id === store.pair.id && !item.closed).sort((a, b) => b.id - a.id).map((item) => {
      const answers = store.homeworkAnswers.filter((answer) => answer.case_id === item.id);
      const mine = answers.find((answer) => answer.user_id === userId) || null;
      const partner = answers.find((answer) => answer.user_id !== userId) || null;
      const ready = store.users.length >= 2 && answers.length >= 2;
      return { id: item.id, note_id: item.note_id, problem: item.problem, created_at: item.created_at, my_answer: mine, partner_submitted: Boolean(partner), ready, partner_answer: ready && partner ? partner : null };
    });
    if (method === 'POST' && data.action === 'create') {
      const note = store.notes.find((item) => item.id === Number(data.note_id) && item.pair_id === store.pair.id && item.category === 'hard');
      if (!note) throw new Error('Эта гадость уже недоступна для разбора.');
      const existing = store.homeworkCases.find((item) => item.pair_id === store.pair.id && item.note_id === note.id && !item.closed);
      if (existing) {
        store.notes = store.notes.filter((item) => item.id !== note.id);
        saveLocalStore(store);
        return { ok: true, id: existing.id, cases: getCases() };
      }
      const created = { id: Date.now(), pair_id: store.pair.id, note_id: null, problem: note.body, closed: false, created_at: new Date().toISOString() };
      store.homeworkCases.push(created);
      store.notes = store.notes.filter((item) => item.id !== note.id);
      saveLocalStore(store);
      return { ok: true, id: created.id, cases: getCases() };
    }
    if (method === 'POST' && data.action === 'close') {
      const item = store.homeworkCases.find((entry) => entry.id === Number(data.case_id) && entry.pair_id === store.pair.id && !entry.closed);
      if (item) item.closed = true;
      saveLocalStore(store);
      return { ok: true, cases: getCases() };
    }
    if (method === 'POST' && data.action === 'answer') {
      const caseId = Number(data.case_id);
      const body = String(data.body || '').trim();
      const active = store.homeworkCases.find((item) => item.id === caseId && item.pair_id === store.pair.id && !item.closed);
      if (!active || body.length < 5) throw new Error('Опиши ситуацию и своё решение — хотя бы несколькими словами.');
      const existing = store.homeworkAnswers.find((item) => item.case_id === caseId && item.user_id === userId);
      if (existing) { existing.body = body; existing.created_at = new Date().toISOString(); }
      else store.homeworkAnswers.push({ case_id: caseId, user_id: userId, body, created_at: new Date().toISOString() });
      saveLocalStore(store);
    }
    return { ok: true, cases: getCases() };
  }

  if (route === '/api/capsule') {
    const active = store.capsule.filter((item) => item.pair_id === store.pair.id && item.user_id === userId && !item.deleted_at);
    if (method === 'GET') {
      if (url.searchParams.get('draw') === '1') return { ok: true, entry: active.length ? active[Math.floor(Math.random() * active.length)] : null };
      return { ok: true, entries: active.sort((a, b) => b.id - a.id) };
    }
    if (method === 'POST') {
      const text = String(data.body || '').trim();
      if (text.length < 2) throw new Error('Запись должна быть от 2 символов.');
      const existing = data.source_note_id ? active.find((item) => item.source_note_id === Number(data.source_note_id)) : null;
      if (existing) existing.text = text;
      else store.capsule.push({ id: Date.now(), pair_id: store.pair.id, user_id: userId, source_note_id: data.source_note_id ? Number(data.source_note_id) : null, text, created_at: new Date().toISOString() });
      saveLocalStore(store);
      return { ok: true };
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const item = store.capsule.find((entry) => entry.id === id);
      if (item) item.deleted_at = new Date().toISOString();
      saveLocalStore(store);
      return { ok: true };
    }
  }

  if (route === '/api/agreements') {
    if (method === 'GET') return { ok: true, agreements: store.agreements.filter((item) => item.pair_id === store.pair.id).sort((a, b) => b.id - a.id) };
    if (method === 'POST') {
      const text = String(data.text || '').trim();
      if (text.length < 3) throw new Error('Договорённость должна быть от 3 символов.');
      const item = { id: Date.now(), pair_id: store.pair.id, user_id: userId, text, status: 'try', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      store.agreements.push(item); saveLocalStore(store); return { ok: true, id: item.id };
    }
    if (method === 'PATCH') {
      const id = Number(url.searchParams.get('id')); const item = store.agreements.find((entry) => entry.id === id);
      if (item) { item.status = data.status; item.updated_at = new Date().toISOString(); }
      saveLocalStore(store); return { ok: true };
    }
    if (method === 'DELETE') { store.agreements = store.agreements.filter((item) => item.id !== Number(url.searchParams.get('id'))); saveLocalStore(store); return { ok: true }; }
  }

  if (route === '/api/decisions') {
    const requestedKind = data.kind || url.searchParams.get('kind');
    const kind = requestedKind && DEFAULT_DECISIONS[requestedKind] ? requestedKind : (requestedKind ? null : null);
    if (requestedKind && !kind) throw new Error('Неизвестный тип решения.');
    const kinds = kind ? [kind] : Object.keys(DEFAULT_DECISIONS);
    const hidden = new Set(store.decisionHidden.filter((item) => item.pair_id === store.pair.id).map((item) => item.key));
    const builtins = kinds.flatMap((item) => DEFAULT_DECISIONS[item].map((text, index) => ({ id: `builtin:${item}:${index}`, text, kind: item, builtin: true })).filter((item) => !hidden.has(item.id)));
    if (method === 'GET') {
      const custom = store.decisions
        .filter((item) => item.pair_id === store.pair.id && !item.deleted_at && kinds.includes(DEFAULT_DECISIONS[item.kind] ? item.kind : DEFAULT_DECISION_TYPES[0].key))
        .map((item) => ({ id: item.id, text: item.text, kind: DEFAULT_DECISIONS[item.kind] ? item.kind : DEFAULT_DECISION_TYPES[0].key, builtin: false, mine: item.user_id === userId }));
      return { ok: true, types: DEFAULT_DECISION_TYPES, options: [...builtins, ...custom] };
    }
    if (method === 'POST') {
      if (data.action === 'choose') {
        const selectedKind = kind || DEFAULT_DECISION_TYPES[0].key;
        const pool = [...builtins, ...store.decisions.filter((item) => item.pair_id === store.pair.id && !item.deleted_at && (item.kind === selectedKind || (!DEFAULT_DECISIONS[item.kind] && selectedKind === DEFAULT_DECISION_TYPES[0].key))).map((item) => ({ id: item.id, text: item.text, kind: DEFAULT_DECISIONS[item.kind] ? item.kind : DEFAULT_DECISION_TYPES[0].key, builtin: false, mine: item.user_id === userId }))];
        return { ok: true, problem: null, choice: pool[Math.floor(Math.random() * pool.length)] || null, options: pool, type: DEFAULT_DECISION_TYPES.find((item) => item.key === selectedKind) };
      }
      const text = String(data.text || '').trim();
      if (text.length < 2 || !kind) throw new Error('Выбери тип и напиши свой вариант.');
      const item = { id: Date.now(), pair_id: store.pair.id, user_id: userId, kind, text };
      store.decisions.push(item); saveLocalStore(store); return { ok: true, id: item.id, kind };
    }
    if (method === 'DELETE') {
      const rawId = url.searchParams.get('id') || '';
      if (rawId.startsWith('builtin:')) {
        if (!builtins.some((item) => item.id === rawId) && !DEFAULT_DECISIONS[rawId.split(':')[1]]?.[Number(rawId.split(':')[2])]) throw new Error('Не удалось найти встроенный вариант.');
        store.decisionHidden.push({ id: Date.now(), pair_id: store.pair.id, user_id: userId, key: rawId });
      } else {
        const id = Number(rawId);
        store.decisions.forEach((item) => { if (item.id === id && item.pair_id === store.pair.id && item.user_id === userId) item.deleted_at = new Date().toISOString(); });
      }
      saveLocalStore(store); return { ok: true };
    }
  }

  if (route === '/api/anniversary-ideas') {
    const viewIdeas = () => {
      const items = store.anniversaryIdeas
        .filter((item) => item.pair_id === store.pair.id)
        .sort((a, b) => b.id - a.id)
        .map((item) => ({ ...item, text: item.text || item.body, mine: item.user_id === userId, author: store.users.find((member) => member.id === item.user_id)?.name || 'Кто-то из вас' }));
      return { ok: true, ideas: items.filter((item) => !item.is_hidden), hidden: items.filter((item) => item.is_hidden) };
    };
    if (method === 'GET') return viewIdeas();
    if (method === 'POST') {
      const text = String(data.text || '').trim();
      if (text.length < 3 || text.length > 500) throw new Error('Идея должна быть от 3 до 500 символов.');
      const item = { id: Date.now(), pair_id: store.pair.id, user_id: userId, body: text, is_hidden: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      store.anniversaryIdeas.push(item);
      saveLocalStore(store);
      return { ok: true, id: item.id };
    }
    const id = Number(url.searchParams.get('id'));
    const item = store.anniversaryIdeas.find((entry) => entry.id === id && entry.pair_id === store.pair.id && entry.user_id === userId);
    if (!item) throw new Error('Можно менять только свои идеи.');
    if (method === 'PATCH') {
      if (typeof data.is_hidden !== 'boolean') throw new Error('Не удалось скрыть идею.');
      item.is_hidden = data.is_hidden;
      item.updated_at = new Date().toISOString();
      saveLocalStore(store);
      return { ok: true };
    }
    if (method === 'DELETE') {
      store.anniversaryIdeas = store.anniversaryIdeas.filter((entry) => entry !== item);
      saveLocalStore(store);
      return { ok: true };
    }
    throw new Error('Метод идей для годовщины не поддерживается.');
  }

  if (route === '/api/games') {
    const partner = store.users.find((m) => m.id !== userId) || null;
    const orderedMembers = [...store.users].sort((a, b) => Number(a.id) - Number(b.id));
    const catUserId = Number(orderedMembers[0]?.id || userId);
    const myTttSide = Number(userId) === catUserId ? 'cat' : 'heart';
    const buildResp = () => ({
      ok: true,
      user: { id: user.id, name: user.name },
      partner: partner ? { id: partner.id, name: partner.name } : null,
      truths: {
        rounds: (store.truthsState.rounds || []).slice(0, 30).map((r) => sanitizeTruthRoundForUser(r, userId)),
        scores: {
          mine: Number(store.truthsState.scores?.[String(userId)] || 0),
          partner: partner ? Number(store.truthsState.scores?.[String(partner.id)] || 0) : 0,
        },
      },
      runner: {
        mine: store.runnerState.records?.[String(userId)] || null,
        partner: partner ? (store.runnerState.records?.[String(partner.id)] || null) : null,
      },
      tictactoe: {
        catMoves: store.tttState.catMoves || [],
        heartMoves: store.tttState.heartMoves || [],
        turn: store.tttState.turn || 'cat',
        winner: store.tttState.winner || null,
        draw: Boolean(store.tttState.draw),
        winLine: store.tttState.winLine || null,
        scores: {
          cat: Number(store.tttState.scores?.cat || 0),
          heart: Number(store.tttState.scores?.heart || 0),
        },
        my_side: myTttSide,
        partner_side: myTttSide === 'cat' ? 'heart' : 'cat',
      },
    });
    if (method === 'GET') return buildResp();
    if (method === 'POST') {
      const action = String(data.action || '');
      if (action === 'truths_create') {
        const truth1 = String(data.truth1 || '').trim();
        const truth2 = String(data.truth2 || '').trim();
        const dream = String(data.dream || '').trim();
        if (truth1.length < 2 || truth2.length < 2 || dream.length < 2) throw new Error('Заполни обе правды и мечту.');
        const tagged = [
          { text: truth1, isDream: false },
          { text: truth2, isDream: false },
          { text: dream, isDream: true },
        ];
        for (let i = tagged.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
        }
        store.truthsState.rounds.unshift({
          id: Date.now(),
          author_id: userId,
          author_name: user.name,
          options: tagged.map((t) => t.text),
          dream_index: tagged.findIndex((t) => t.isDream),
          created_at: new Date().toISOString(),
          completed_at: null,
          guesser_id: null,
          guesser_name: null,
          guessed_index: null,
          is_correct: null,
        });
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'truths_guess') {
        const round = (store.truthsState.rounds || []).find((r) => Number(r.id) === Number(data.round_id));
        const guessedIndex = Number(data.guessed_index);
        if (!round || round.completed_at) throw new Error('Раунд уже завершён.');
        if (!Number.isInteger(guessedIndex) || guessedIndex < 0 || guessedIndex > 2) throw new Error('Выбери вариант.');
        round.guessed_index = guessedIndex;
        round.guesser_id = userId;
        round.guesser_name = user.name;
        round.is_correct = guessedIndex === Number(round.dream_index);
        round.completed_at = new Date().toISOString();
        if (round.is_correct) {
          store.truthsState.scores[String(userId)] = Number(store.truthsState.scores[String(userId)] || 0) + 1;
        }
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'truths_delete') {
        store.truthsState.rounds = (store.truthsState.rounds || []).filter((r) => Number(r.id) !== Number(data.round_id));
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'truths_reset') {
        store.truthsState = { rounds: [], scores: {} };
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'runner_score') {
        const score = Math.max(0, Math.round(Number(data.score || 0)));
        const prev = store.runnerState.records[String(userId)] || { best_score: 0 };
        store.runnerState.records[String(userId)] = {
          name: user.name,
          best_score: Math.max(Number(prev.best_score || 0), score),
          updated_at: new Date().toISOString(),
        };
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'ttt_move') {
        const side = myTttSide;
        if (store.tttState.turn !== side) throw new Error('Сейчас ход соперника.');
        if (store.tttState.winner || store.tttState.draw) throw new Error('Партия завершена. Начните новую.');
        const next = applyClassicMove(store.tttState, side, data.cell);
        store.tttState = {
          ...next,
          scores: {
            cat: Number(store.tttState.scores?.cat || 0) + (next.winner === 'cat' ? 1 : 0),
            heart: Number(store.tttState.scores?.heart || 0) + (next.winner === 'heart' ? 1 : 0),
          },
        };
        saveLocalStore(store);
        return buildResp();
      }
      if (action === 'ttt_reset') {
        store.tttState = {
          catMoves: [],
          heartMoves: [],
          turn: data.next_turn === 'heart' ? 'heart' : 'cat',
          winner: null,
          draw: false,
          winLine: null,
          scores: store.tttState.scores || { cat: 0, heart: 0 },
        };
        saveLocalStore(store);
        return buildResp();
      }
    }
    throw new Error('Неизвестное действие игры.');
  }

  if (route === '/api/wishes') {
    const kind = url.searchParams.get('kind') === 'intimate' ? 'intimate' : 'general';
    const partner = store.users.find((member) => member.id !== userId) || null;
    const inKind = (item) => (item.kind || 'general') === kind;
    const viewWishes = () => ({
      ok: true,
      kind,
      mine_name: user.name,
      partner_name: partner?.name || 'Партнёр',
      mine: store.wishes.filter((item) => item.pair_id === store.pair.id && item.user_id === userId && inKind(item)).sort((a, b) => b.id - a.id),
      partner: partner ? store.wishes.filter((item) => item.pair_id === store.pair.id && item.user_id === partner.id && inKind(item) && !item.is_hidden).sort((a, b) => b.id - a.id) : [],
      partner_hidden_count: partner ? store.wishes.filter((item) => item.pair_id === store.pair.id && item.user_id === partner.id && inKind(item) && item.is_hidden).length : 0,
    });
    if (method === 'GET') return viewWishes();
    if (method === 'POST') {
      const requestedKind = data.kind === 'intimate' ? 'intimate' : 'general';
      if (requestedKind !== kind) throw new Error('Не удалось определить список желаний.');
      const text = String(data.text || '').trim();
      if (text.length < 3 || text.length > 500) throw new Error('Желание должно быть от 3 до 500 символов.');
      const item = { id: Date.now(), pair_id: store.pair.id, user_id: userId, kind, body: text, is_hidden: kind === 'intimate', received: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      store.wishes.push(item);
      saveLocalStore(store);
      return { ok: true, id: item.id };
    }
    if (method === 'PATCH') {
      const id = Number(url.searchParams.get('id'));
      const item = store.wishes.find((entry) => entry.id === id && entry.pair_id === store.pair.id && entry.user_id === userId);
      if (!item) throw new Error('Это желание нельзя изменить.');
      if (typeof data.is_hidden === 'boolean') item.is_hidden = data.is_hidden;
      if (typeof data.received === 'boolean') item.received = data.received;
      item.updated_at = new Date().toISOString();
      saveLocalStore(store);
      return { ok: true };
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      store.wishes = store.wishes.filter((item) => !(item.id === id && item.pair_id === store.pair.id && item.user_id === userId));
      saveLocalStore(store);
      return { ok: true };
    }
    throw new Error('Метод списка желаний не поддерживается.');
  }

  if (route === '/api/wins') {
    if (method === 'GET') return { ok: true, wins: store.wins.filter((item) => item.pair_id === store.pair.id && !item.deleted_at).sort((a, b) => b.id - a.id) };
    if (method === 'POST') {
      const text = String(data.text || '').trim();
      if (text.length < 2) throw new Error('Победа должна быть от 2 символов.');
      store.wins.push({ id: Date.now(), pair_id: store.pair.id, user_id: userId, text, created_at: new Date().toISOString() }); saveLocalStore(store); return { ok: true };
    }
    if (method === 'DELETE') { store.wins = store.wins.filter((item) => item.id !== Number(url.searchParams.get('id'))); saveLocalStore(store); return { ok: true }; }
  }

  if (route === '/api/feedback') {
    if (method === 'GET') {
      return { ok: true, ideas: store.feedback.filter((item) => item.pair_id === store.pair.id && !item.deleted_at).sort((a, b) => b.id - a.id).map((item) => ({ ...item, mine: item.user_id === userId })) };
    }
    if (method === 'POST') {
      const text = String(data.text || '').trim();
      if (text.length < 2 || text.length > 2000) throw new Error('Идея должна быть от 2 до 2000 символов.');
      const item = { id: Date.now(), pair_id: store.pair.id, user_id: userId, text, created_at: new Date().toISOString() };
      store.feedback.push(item);
      saveLocalStore(store);
      return { ok: true, id: item.id };
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const item = store.feedback.find((entry) => entry.id === id && entry.pair_id === store.pair.id && entry.user_id === userId);
      if (item) item.deleted_at = new Date().toISOString();
      saveLocalStore(store);
      return { ok: true };
    }
  }

  if (route === '/api/ideas') {
    const kind = url.searchParams.get('kind') || 'budget';
    const place = url.searchParams.get('place') || 'inside';
    if (!DEFAULT_IDEAS[kind]?.[place]) throw new Error('Неизвестная категория свидания.');
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      store.ideas = store.ideas.filter((idea) => !(idea.id === id && idea.user_id === userId));
      saveLocalStore(store);
      return { ok: true };
    }
    if (method === 'POST') {
      const text = String(data.text || '').trim();
      if (text.length < 3 || text.length > 300) throw new Error('Идея должна быть от 3 до 300 символов.');
      if (data.hidden) store.ideas.forEach((item) => { if (item.kind === kind && item.place === place && item.text === text) item.hidden = true; });
      const idea = { id: Date.now(), pair_id: store.pair.id, author_id: userId, kind, place, text, hidden: Boolean(data.hidden) };
      store.ideas.push(idea);
      saveLocalStore(store);
      return { ok: true, idea };
    }
    const custom = store.ideas.filter((idea) => idea.kind === kind && (idea.place || 'inside') === place && !idea.hidden);
    if (url.searchParams.get('list') === '1') return { ok: true, ideas: custom.map((idea) => ({ ...idea, mine: idea.author_id === userId })) };
    const hidden = new Set(store.ideas.filter((idea) => idea.kind === kind && (idea.place || 'inside') === place && idea.hidden).map((idea) => idea.text));
    const pool = [...DEFAULT_IDEAS[kind][place].filter((text) => !hidden.has(text)).map((text) => ({ text, kind, place, custom: false })), ...custom.map((idea) => ({ ...idea, custom: true }))];
    return { ok: true, idea: pool[Math.floor(Math.random() * pool.length)] || null };
  }

  throw new Error('Неизвестный запрос.');
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 404 || !contentType.includes('application/json')) return localApi(path, options);
    const data = await response.json().catch(() => ({ ok: false, error: 'Неожиданный ответ сервера.' }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Что-то пошло не так.');
    return data;
  } catch (error) {
    if (error instanceof TypeError) return localApi(path, options);
    throw error;
  }
}

function showToast(text) {
  const toast = $('#toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function showAuthError(text = '') {
  const alert = $('#authAlert');
  alert.textContent = text ? `Ошибка: ${text}` : '';
  alert.classList.toggle('hidden', !text);
  $('#authError').textContent = '';
}

function showAuth(tab = 'create') {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
  $$('.auth-tab').forEach((button) => button.classList.toggle('active', button.dataset.auth === tab));
  $('#createForm').classList.toggle('hidden', tab !== 'create');
  $('#joinForm').classList.toggle('hidden', tab !== 'join');
  $('#loginForm').classList.toggle('hidden', tab !== 'login');
}

function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
}

function prettyDate(value) {
  if (!value) return '';
  const key = dateKey(value);
  if (!key) return '';
  const date = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function prettyNoteDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function reorderNavigation(containerSelector, attribute, order) {
  const container = $(containerSelector);
  if (!container) return;
  const buttons = [...container.querySelectorAll(`[${attribute}]`)];
  const byKey = new Map(buttons.map((button) => [button.getAttribute(attribute), button]));
  order.forEach((key) => {
    const button = byKey.get(key);
    if (button) container.append(button);
  });
}

function applyPersonalization(preferences) {
  const normalized = normalizeClientPreferences(preferences);
  document.documentElement.dataset.theme = normalized.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BROWSER_COLORS[normalized.theme] || THEME_BROWSER_COLORS.pink);
  reorderNavigation('.main-tabs', 'data-view', normalized.orders.main);
  reorderNavigation('#mailboxSubnav', 'data-mailbox-view', normalized.orders.mailbox);
  reorderNavigation('.games-subtabs', 'data-game-subtab', normalized.orders.games);
  reorderNavigation('.date-subtabs', 'data-date-subtab', normalized.orders.dates);
  return normalized;
}

function renderPersonalizationModal() {
  if (!personalizationDraft) return;
  const themeChoices = $('#themeChoices');
  const tabOrderControls = $('#tabOrderControls');
  if (!themeChoices || !tabOrderControls) return;
  themeChoices.innerHTML = PERSONAL_THEME_KEYS.map((theme) => `
    <button class="theme-choice ${personalizationDraft.theme === theme ? 'selected' : ''}" type="button" data-theme-choice="${theme}" aria-pressed="${personalizationDraft.theme === theme}">
      <span class="theme-dot theme-dot-${theme}" aria-hidden="true"></span><span>${THEME_LABELS[theme]}</span>
    </button>`).join('');
  tabOrderControls.innerHTML = Object.entries(TAB_ORDER_DEFAULTS).map(([group, fallback]) => `
    <section class="tab-order-group" data-order-group="${group}">
      <h5>${TAB_ORDER_TITLES[group]}</h5>
      <div class="tab-order-list">${personalizationDraft.orders[group].map((key, index) => `
        <div class="tab-order-item"><span>${escapeHtml(TAB_ORDER_LABELS[group][key] || key)}</span>
          <span class="tab-order-moves"><button type="button" data-order-move="${group}" data-order-index="${index}" data-order-direction="-1" aria-label="Переместить выше" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-order-move="${group}" data-order-index="${index}" data-order-direction="1" aria-label="Переместить ниже" ${index === fallback.length - 1 ? 'disabled' : ''}>↓</button></span>
        </div>`).join('')}</div>
    </section>`).join('');
  themeChoices.querySelectorAll('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => {
    personalizationDraft.theme = button.dataset.themeChoice;
    renderPersonalizationModal();
  }));
  tabOrderControls.querySelectorAll('[data-order-move]').forEach((button) => button.addEventListener('click', () => {
    const group = button.dataset.orderMove;
    const index = Number(button.dataset.orderIndex);
    const destination = index + Number(button.dataset.orderDirection);
    const order = personalizationDraft.orders[group];
    if (!order || destination < 0 || destination >= order.length) return;
    [order[index], order[destination]] = [order[destination], order[index]];
    renderPersonalizationModal();
  }));
}

function openPersonalization() {
  if (!appState) return;
  personalizationDraft = normalizeClientPreferences(appState.preferences);
  renderPersonalizationModal();
  openModal('personalizationModal');
}

async function savePersonalization() {
  if (!personalizationDraft) return;
  const button = $('#savePersonalizationButton');
  if (button) button.disabled = true;
  try {
    const result = await api('/api/preferences', { method: 'POST', body: JSON.stringify(personalizationDraft) });
    appState.preferences = normalizeClientPreferences(result.preferences);
    applyPersonalization(appState.preferences);
    closeModal('personalizationModal');
    personalizationDraft = null;
    showToast('Твой вид ящика сохранён.');
  } catch (error) {
    showToast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function cloneStarterPartnerFields() {
  return DEFAULT_PARTNER_PROFILE_FIELDS.map((field) => ({ ...field }));
}

function profileFieldsForForm() {
  const fieldHost = $('#partnerProfileFields');
  if (!fieldHost) return [];
  return [...fieldHost.querySelectorAll('[data-profile-field]')].map((row, index) => ({
    id: row.dataset.profileField || `field_${index + 1}`,
    label: String(row.querySelector('[name="label"]')?.value || '').trim().replace(/\s+/g, ' ').slice(0, 50),
    value: String(row.querySelector('[name="value"]')?.value || '').trim().replace(/\s+/g, ' ').slice(0, 300),
    accent: normalizePartnerProfileAccent(row.querySelector('[name="accent"]')?.value),
  })).filter((field) => field.label);
}

function partnerProfileViewMarkup(fields, partnerName) {
  // A profile should read as a small collection of memories, not as an inventory.
  // Empty starter fields remain available in edit mode but stay out of the read view.
  const filledFields = fields.filter((field) => String(field.value || '').trim());
  const initial = escapeHtml(String(partnerName || 'П').trim().slice(0, 1).toUpperCase());
  return `
    <section class="partner-profile-cover">
      <div class="partner-profile-avatar" aria-hidden="true"><span>${initial}</span></div>
      <div class="partner-profile-identity">
        <span class="partner-profile-kicker">личная карточка</span>
        <strong>${escapeHtml(partnerName)}</strong>
        <span>то, что хочется бережно помнить</span>
      </div>
    </section>
    ${filledFields.length ? `
      <div class="partner-profile-memories-heading"><span>Маленькие штрихи</span><b>только для тебя</b></div>
      <div class="partner-profile-memory-grid">${filledFields.map((field) => `
        <article class="partner-profile-memory-card accent-${normalizePartnerProfileAccent(field.accent)}">
          <span class="partner-profile-memory-label">${escapeHtml(field.label)}</span>
          <b>${escapeHtml(field.value)}</b>
          <span class="partner-profile-memory-spark" aria-hidden="true"></span>
        </article>`).join('')}</div>`
      : '<div class="partner-profile-empty partner-profile-empty-soft"><span class="partner-profile-empty-heart" aria-hidden="true"></span><p>Пока здесь тихо. Добавь одну деталь, которая делает этого человека именно им.</p></div>'}`;
}

function renderPartnerProfileEditor(fields) {
  const host = $('#partnerProfileFields');
  if (!host) return;
  host.innerHTML = fields.map((field, index) => {
    const selectedAccent = normalizePartnerProfileAccent(field.accent);
    const accentOptions = Object.entries(PARTNER_PROFILE_ACCENTS).map(([key, label]) => `<option value="${key}"${key === selectedAccent ? ' selected' : ''}>${label}</option>`).join('');
    return `
      <div class="partner-profile-field" data-profile-field="${escapeHtml(field.id || `field_${index + 1}`)}">
        <label>Название<input name="label" type="text" maxlength="50" value="${escapeHtml(field.label || '')}" placeholder="Например, любимый цвет"></label>
        <label>Ответ<input name="value" type="text" maxlength="300" value="${escapeHtml(field.value || '')}" placeholder="Ответ позже"></label>
        <label class="partner-profile-accent-label">Акцент<select name="accent" aria-label="Цвет штриха">${accentOptions}</select></label>
        <button class="profile-field-remove" type="button" data-remove-profile-field="${index}" aria-label="Удалить пункт ${escapeHtml(field.label || '')}" title="Удалить пункт">×</button>
      </div>`;
  }).join('');
  host.querySelectorAll('[data-remove-profile-field]').forEach((button) => button.addEventListener('click', () => {
    const currentFields = profileFieldsForForm();
    currentFields.splice(Number(button.dataset.removeProfileField), 1);
    partnerProfileData.fields = currentFields;
    renderPartnerProfile();
  }));
}

function renderPartnerProfile() {
  const view = $('#partnerProfileView');
  const form = $('#partnerProfileForm');
  const edit = $('#editPartnerProfileButton');
  const title = $('#partnerProfileTitle');
  if (!view || !form || !edit || !partnerProfileData) return;
  const partnerName = partnerProfileData.partner?.name || appState?.partner?.name || 'партнёра';
  const fields = Array.isArray(partnerProfileData.fields) ? partnerProfileData.fields : cloneStarterPartnerFields();
  partnerProfileData.fields = fields;
  if (title) title.textContent = `Карточка ${partnerName}`;
  view.innerHTML = partnerProfileViewMarkup(fields, partnerName);
  view.classList.toggle('hidden', partnerProfileEditing);
  form.classList.toggle('hidden', !partnerProfileEditing);
  edit.classList.toggle('hidden', partnerProfileEditing);
  edit.textContent = partnerProfileData.saved ? 'Редактировать' : 'Заполнить карточку';
  if (partnerProfileEditing) renderPartnerProfileEditor(fields);
}

async function openPartnerProfile() {
  if (!appState?.partner) {
    showToast('Карточка появится, когда второй участник подключится к ящику.');
    return;
  }
  try {
    const result = await api('/api/partner-profile');
    const saved = Array.isArray(result.fields);
    partnerProfileData = {
      partner: result.partner || appState.partner,
      fields: saved ? result.fields : cloneStarterPartnerFields(),
      saved,
      updated_at: result.updated_at || null,
    };
    partnerProfileEditing = false;
    renderPartnerProfile();
    openModal('partnerProfileModal');
  } catch (error) { showToast(error.message); }
}

function beginPartnerProfileEdit() {
  if (!partnerProfileData) return;
  partnerProfileEditing = true;
  renderPartnerProfile();
  $('#partnerProfileFields')?.querySelector('[name="value"]')?.focus();
}

function addPartnerProfileField() {
  if (!partnerProfileData) return;
  const fields = profileFieldsForForm();
  if (fields.length >= 24) return showToast('В карточке можно хранить до 24 пунктов.');
  fields.push({ id: `custom_${Date.now()}`, label: 'Новый пункт', value: '', accent: 'theme' });
  partnerProfileData.fields = fields;
  partnerProfileEditing = true;
  renderPartnerProfile();
  const inputs = $('#partnerProfileFields')?.querySelectorAll('[name="label"]');
  inputs?.[inputs.length - 1]?.focus();
  inputs?.[inputs.length - 1]?.select();
}

async function savePartnerProfile(event) {
  event.preventDefault();
  if (!partnerProfileData) return;
  const fields = profileFieldsForForm();
  const submit = event.currentTarget.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const result = await api('/api/partner-profile', { method: 'POST', body: JSON.stringify({ fields }) });
    partnerProfileData = {
      ...partnerProfileData,
      partner: result.partner || partnerProfileData.partner,
      fields: Array.isArray(result.fields) ? result.fields : fields,
      saved: true,
    };
    partnerProfileEditing = false;
    renderPartnerProfile();
    showToast('Карточка партнёра сохранена.');
  } catch (error) { showToast(error.message); } finally { if (submit) submit.disabled = false; }
}

function fullscreenRoot() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isFallbackFullscreen(target) {
  return Boolean(target?.classList.contains('game-fallback-fullscreen'));
}

function setFallbackFullscreen(target, enabled) {
  if (!target) return;
  target.classList.toggle('game-fallback-fullscreen', enabled);
  document.documentElement.classList.toggle('game-fallback-fullscreen-active', enabled);
  document.body.classList.toggle('game-fallback-fullscreen-active', enabled);
  if (enabled) {
    target.setAttribute('data-fallback-fullscreen', 'true');
    target.focus?.({ preventScroll: true });
  } else {
    target.removeAttribute('data-fallback-fullscreen');
  }
  updateFullscreenButtons();
}

function updateFullscreenButtons() {
  const current = fullscreenRoot();
  $$('.game-fullscreen-button').forEach((button) => {
    const target = $(`#${button.dataset.fullscreenTarget}`);
    const isCurrent = Boolean(target && (current === target || isFallbackFullscreen(target)));
    button.textContent = isCurrent ? '×' : '⛶';
    button.setAttribute('aria-label', isCurrent ? 'Выйти из полноэкранного режима' : 'Развернуть игру на весь экран');
    button.title = isCurrent ? 'Свернуть' : 'На весь экран';
  });
}

async function requestNativeFullscreen(target) {
  const request = target?.requestFullscreen || target?.webkitRequestFullscreen;
  if (!request) return false;
  try {
    await request.call(target, { navigationUI: 'hide' });
  } catch {
    try {
      await request.call(target);
    } catch {
      return false;
    }
  }
  if (fullscreenRoot() === target) return true;
  // Older WebKit APIs may return undefined before their fullscreenchange event arrives.
  return new Promise((resolve) => {
    let timer = null;
    const finish = () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      if (timer) clearTimeout(timer);
      resolve(fullscreenRoot() === target);
    };
    const onChange = () => finish();
    document.addEventListener('fullscreenchange', onChange, { once: true });
    document.addEventListener('webkitfullscreenchange', onChange, { once: true });
    timer = setTimeout(finish, 280);
  });
}

async function toggleGameFullscreen(targetId) {
  const target = $(`#${targetId}`);
  if (!target) return;
  if (isFallbackFullscreen(target)) {
    setFallbackFullscreen(target, false);
    return;
  }
  if (fullscreenRoot() === target) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) {
      try { await exit.call(document); } catch { setFallbackFullscreen(target, false); }
    } else {
      setFallbackFullscreen(target, false);
    }
    setTimeout(updateFullscreenButtons, 60);
    return;
  }

  // Safari/iOS and some embedded/Yandex views do not expose a usable native API.
  // In that case the same panel expands with a CSS fallback instead of doing nothing.
  const openedNatively = await requestNativeFullscreen(target);
  if (!openedNatively) setFallbackFullscreen(target, true);
  setTimeout(updateFullscreenButtons, 60);
}

function renderAchievements() {
  const strip = $('#achievementStrip');
  const achievements = appState?.achievements || [];
  strip.classList.toggle('hidden', !achievements.length);
  strip.innerHTML = achievements.slice(0, 6).map((item) => `<span class="achievement-badge">${escapeHtml(ACHIEVEMENT_LABELS[item.kind] || 'Ты сделал(а) важный шаг')}</span>`).join('');
}

function nextEncouragement(kind = 'calm') {
  const list = ENCOURAGEMENTS[kind] || ENCOURAGEMENTS.calm;
  const key = ENCOURAGEMENTS[kind] ? kind : 'calm';
  encouragementCursor[key] = (encouragementCursor[key] + 1) % list.length;
  return list[encouragementCursor[key]];
}

function renderEncouragement(kindOrText = 'calm') {
  const card = $('#encouragementCard');
  const text = ENCOURAGEMENTS[kindOrText] ? nextEncouragement(kindOrText) : String(kindOrText);
  if (!card) return;
  card.classList.remove('hidden');
  card.classList.add('pulse-soft');
  $('#encouragementText').textContent = text;
  clearTimeout(renderEncouragement.timer);
  renderEncouragement.timer = setTimeout(() => card.classList.remove('pulse-soft'), 1300);
}

function renderTalkOutcome() {
  const actions = $('#talkOutcomeActions');
  const message = $('#talkOutcomeMessage');
  if (!actions || !message) return;
  const outcome = appState?.latest_outcome;
  if (!outcome) {
    actions.classList.remove('hidden');
    message.classList.add('hidden');
    message.textContent = '';
    return;
  }
  actions.classList.add('hidden');
  message.classList.remove('hidden');
  message.textContent = outcome.result === 'resolved'
    ? 'Вы молодцы, что смогли поговорить и найти решение. Так держать — маленькие честные разговоры правда меняют всё ✨'
    : 'Не всё обязано решиться за один разговор. Вы уже сделали важный шаг. Можно вернуться к этому позже — бережно, без обвинений, вы разберётесь 🤍';
}

function rememberHomeworkDrafts() {
  document.querySelectorAll('[data-homework-form]').forEach((form) => {
    const textarea = form.querySelector('textarea[name="body"]');
    const caseId = form.dataset.homeworkForm;
    if (!textarea || !caseId) return;
    if (document.activeElement === textarea || textarea.dataset.dirty === 'true') {
      homeworkDrafts.set(String(caseId), textarea.value);
    }
  });
}

function renderHomework() {
  rememberHomeworkDrafts();
  const card = $('#homeworkCard');
  if (!card || !appState) return;
  const cases = homeworkState?.cases || (homeworkState?.active ? [homeworkState] : []);
  const shouldShow = Boolean(cases.length || (appState.opened && appState.latest_outcome?.result === 'not_yet'));
  card.classList.toggle('hidden', !shouldShow);
  $('#homeworkEmpty')?.classList.toggle('hidden', shouldShow);
  if (activeView === 'homework') setActiveViewInfo('homework');
  if (!shouldShow) return;
  const picker = $('#homeworkPicker');
  const active = $('#homeworkActive');
  const selectedIds = new Set(cases.map((item) => item.note_id));
  const hardNotes = (appState.notes || []).filter((note) => note.category === 'hard' && !selectedIds.has(note.id));
  picker.classList.remove('hidden');
  picker.innerHTML = hardNotes.length
    ? `<p class="small-note">Можно выбрать ещё любую гадость для отдельного разбора:</p>${hardNotes.map((note) => `<button data-homework-note="${note.id}">🧊 ${escapeHtml(note.body)}</button>`).join('')}`
    : cases.length ? '<p class="small-note">Все выбранные гадости уже добавлены в домашние задания.</p>' : '<p class="small-note">Гадостей для отдельного разбора пока нет. Если захочется, добавьте одну в ящик.</p>';
  picker.querySelectorAll('[data-homework-note]').forEach((button) => button.addEventListener('click', () => chooseHomework(Number(button.dataset.homeworkNote))));
  if (!cases.length) { active.classList.add('hidden'); active.innerHTML = ''; return; }
  active.classList.remove('hidden');
  active.innerHTML = cases.map((item) => {
    const draft = homeworkDrafts.has(String(item.id)) ? homeworkDrafts.get(String(item.id)) : (item.my_answer?.body || '');
    return `<article class="homework-case-block">
    <div class="homework-problem"><span>🧊 выбранная гадость</span><p>${escapeHtml(item.problem)}</p></div>
    <form class="homework-form" data-homework-form="${item.id}">
      <label>Твой взгляд на ситуацию и решение
        <textarea name="body" maxlength="3500" placeholder="Опиши всё в красках: что произошло, что ты почувствовал(а) и как, по-твоему, это можно решить…" required>${escapeHtml(draft)}</textarea>
      </label>
      <button class="button primary" type="submit">${item.my_answer ? 'Обновить свой ответ' : 'Отправить свой ответ'}</button>
    </form>
    <div class="homework-status">${item.ready ? 'Оба ответа уже готовы — можно спокойно ознакомиться с ними.' : item.my_answer ? 'Твой ответ сохранён. Ждём, когда партнёр напишет свой взгляд.' : 'Каждый пишет ответ отдельно. До этого момента чужой текст закрыт.'}</div>
    ${item.ready && item.partner_answer ? `<div class="homework-partner-answer"><strong>Взгляд партнёра</strong>${escapeHtml(item.partner_answer.body)}</div><button class="button secondary homework-close" data-close-homework="${item.id}">Закрыть это задание</button>` : ''}
  </article>`;
  }).join('');
  active.querySelectorAll('[data-homework-form]').forEach((form) => {
    const textarea = form.querySelector('textarea[name="body"]');
    textarea?.addEventListener('input', () => {
      const caseId = form.dataset.homeworkForm;
      homeworkDrafts.set(String(caseId), textarea.value);
      textarea.dataset.dirty = 'true';
    });
    form.addEventListener('submit', saveHomeworkAnswer);
  });
  active.querySelectorAll('[data-close-homework]').forEach((button) => button.addEventListener('click', async () => {
    await api('/api/homework', { method: 'POST', body: JSON.stringify({ action: 'close', case_id: button.dataset.closeHomework }) });
    homeworkDrafts.delete(String(button.dataset.closeHomework));
    showToast('Домашнее задание закрыто. Вы справились с важным шагом 💗');
    await loadHomework();
  }));
}

async function loadHomework() {
  try {
    homeworkState = await api('/api/homework');
    renderHomework();
    const discussion = $('#revealedSection');
    if (discussion && appState?.opened) discussion.classList.remove('hidden');
  } catch (error) {
    if (!error.message.includes('Сначала войдите')) showToast(error.message);
  }
}

async function chooseHomework(noteId) {
  try {
    await api('/api/homework', { method: 'POST', body: JSON.stringify({ action: 'create', note_id: noteId }) });
    showToast('Гадость отправлена в домашнее задание. Теперь каждый может написать свой взгляд отдельно.');
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function saveHomeworkAnswer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = String(new FormData(form).get('body') || '');
  const caseId = Number(form.dataset.homeworkForm);
  if (!caseId) return;
  try {
    await api('/api/homework', { method: 'POST', body: JSON.stringify({ action: 'answer', case_id: caseId, body }) });
    const textarea = form.querySelector('textarea[name="body"]');
    if (textarea) {
      textarea.value = body.trim();
      textarea.dataset.dirty = 'false';
    }
    homeworkDrafts.delete(String(caseId));
    showToast('Твой ответ сохранён отдельно.');
    await loadHomework();
  } catch (error) { showToast(error.message); }
}

async function saveOutcome(result) {
  try {
    await api('/api/outcome', { method: 'POST', body: JSON.stringify({ result }) });
    renderEncouragement(result === 'resolved' ? 'sweet' : 'hard');
    showToast(result === 'resolved' ? 'Вы молодцы, так держать ✨' : 'Всё хорошо. Разберёмся маленькими шагами.');
    showToast(`Новая ачивка: ${ACHIEVEMENT_LABELS[result === 'resolved' ? 'talk_resolved' : 'talk_kept_trying']} ✦`);
    await refresh();
  } catch (error) { showToast(error.message); }
}

function renderState() {
  if (!appState) return;
  appState.preferences = applyPersonalization(appState.preferences);
  $('#userName').textContent = appState.user.name;
  const profileNameInput = $('#profileNameInput');
  if (profileNameInput && document.activeElement !== profileNameInput) profileNameInput.value = appState.user.name;
  const partnerBadge = $('#partnerBadge');
  partnerBadge.textContent = appState.partner ? `Вместе с ${appState.partner.name}` : 'Ждём второго участника';
  partnerBadge.disabled = !appState.partner;
  partnerBadge.classList.toggle('is-waiting', !appState.partner);
  $('#sweetCount').textContent = appState.counts.sweet;
  $('#hardCount').textContent = appState.counts.hard;
  $('#inviteCode').textContent = appState.pair_code;
  $('#timezoneLabel').textContent = appState.timezone;
  $('#nudgeToggle').checked = appState.nudge_enabled;
  $('#pinStatus').textContent = appState.pin_set ? 'PIN установлен. Если сессия когда-нибудь потеряется, используй вкладку «Войти снова» — код пары больше не понадобится.' : 'Установи PIN сейчас — он поможет вернуться в этот же аккаунт, если браузер забудет сессию.';
  const inviteBanner = $('#inviteBanner');
  inviteBanner.classList.toggle('hidden', Boolean(appState.partner));
  $('#inviteBannerCode').textContent = appState.pair_code;
  renderAchievements();
  renderTalkOutcome();
  renderHomework();

  const scheduled = appState.scheduled_date || appState.scheduled_for;
  $('#scheduledMini').innerHTML = scheduled
    ? `Ваш разговор: <strong>${escapeHtml(prettyDate(scheduled))}</strong>`
    : 'Дата разговора пока не выбрана.';

  const cycle = $('#cycleCard');
  if (appState.can_open) {
    cycle.classList.remove('hidden');
    cycle.innerHTML = `<div class="card-kicker">день разговора настал</div><p>Можно открыть записи, когда будете готовы спокойно поговорить.</p><button id="openButton" class="button">Открыть записи <span>→</span></button>`;
    $('#openButton').onclick = openNotes;
  } else {
    cycle.classList.add('hidden');
  }

  const revealed = $('#revealedSection');
  const conversationIsOpen = Boolean(appState.opened);
  $('#conversationEmpty')?.classList.toggle('hidden', conversationIsOpen);
  if (conversationIsOpen) {
    revealed.classList.remove('hidden');
    $('#notesList').innerHTML = appState.notes.length
      ? appState.notes.map((note) => `<article class="note-item"><div class="note-meta"><span class="note-author">${note.category === 'sweet' ? '🍬' : '🧊'} ${escapeHtml(note.author)}</span><span>${escapeHtml(prettyNoteDate(note.created_at))}</span></div><div class="note-body">${escapeHtml(note.body)}</div><div class="note-actions">${note.category === 'sweet' ? `<button data-save-capsule="${note.id}">Сохранить в капсулу тепла</button>` : `<button data-homework-note="${note.id}">В домашнее задание</button><button data-delete-note="${note.id}">Удалить — решено</button>`}</div></article>`).join('')
      : '<article class="note-item"><div class="note-body">В ящике пока пусто. Можно просто поговорить о том, что сейчас между вами.</div></article>';
  } else {
    revealed.classList.add('hidden');
  }
  $('#notesList').querySelectorAll('[data-save-capsule]').forEach((button) => button.addEventListener('click', () => saveNoteToCapsule(Number(button.dataset.saveCapsule))));
  $('#notesList').querySelectorAll('[data-homework-note]').forEach((button) => button.addEventListener('click', () => chooseHomework(Number(button.dataset.homeworkNote))));
  $('#notesList').querySelectorAll('[data-delete-note]').forEach((button) => button.addEventListener('click', () => deleteNote(Number(button.dataset.deleteNote))));

  const scheduleInput = $('#scheduleInput');
  const scheduledKey = dateKey(scheduled);
  scheduleInput.value = scheduledKey && /^\d{4}-\d{2}-\d{2}$/.test(scheduledKey) ? scheduledKey : '';
  scheduleInput.min = localDateKeyNow();
}

async function refresh() {
  try {
    appState = await api('/api/state');
    showApp();
    renderState();
    await loadHomework();
    renderState();
    checkReminder();
  } catch (error) {
    if (error.message.includes('Сначала войдите')) showAuth(localStorage.getItem('quiet_mailbox_auth') || 'create');
    else showToast(error.message);
  }
}

async function submitAuth(event, mode) {
  event.preventDefault();
  showAuthError('');
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const result = await api(`/api/${mode}`, { method: 'POST', body: JSON.stringify(data) });
    localStorage.setItem('quiet_mailbox_auth', 'login');
    if (result.invite_code) showToast(`Ящик создан. Код: ${result.invite_code}`);
    await refresh();
  } catch (error) {
    showAuthError(error.message);
  }
}

function randomFrom(list) { return list[Math.floor(Math.random() * list.length)]; }

async function saveNoteToCapsule(noteId) {
  const note = appState?.notes?.find((item) => item.id === noteId);
  if (!note) return;
  try {
    await api('/api/capsule', { method: 'POST', body: JSON.stringify({ body: note.body, source_note_id: note.id }) });
    showToast('Сладость сохранена в Капсулу тепла ✨');
    await loadOurData();
  } catch (error) { showToast(error.message); }
}

async function deleteNote(noteId) {
  if (!window.confirm('Удалить эту гадость как решённую? Её текст исчезнет из текущего ящика.')) return;
  try {
    await api(`/api/notes?id=${noteId}`, { method: 'DELETE' });
    showToast('Конфликт отмечен решённым и удалён.');
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function saveNote() {
  const body = $('#noteBody').value.trim();
  if (!body) { showToast('Сначала напиши текст записи.'); return; }
  try {
    const result = await api('/api/notes', { method: 'POST', body: JSON.stringify({ category: selectedCategory, body }) });
    $('#noteBody').value = '';
    $('#charCount').textContent = '0 / 3500';
    renderEncouragement(selectedCategory);
    showToast(selectedCategory === 'hard' ? 'Сохранено. Спасибо, что поделился(ась) — разберёмся вместе 💗' : 'Сохранено в тихий ящик 💌');
    if (result.achievement) showToast(`Новая ачивка: ${ACHIEVEMENT_LABELS[result.achievement.kind] || 'важный шаг'} ✦`);
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function saveSchedule() {
  const value = String($('#scheduleInput').value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { showToast('Выбери корректный день разговора.'); return; }
  try {
    await api('/api/schedule', { method: 'POST', body: JSON.stringify({ scheduled_date: value }) });
    renderEncouragement('calm');
    showToast('День разговора сохранён.');
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function talkNow() {
  if (!window.confirm('Точно готовы открыть записи прямо сейчас для вас обоих?\n\nПосле подтверждения они станут видны обоим участникам.')) return;
  try {
    await api('/api/open', { method: 'POST', body: JSON.stringify({ now: true }) });
    renderEncouragement('hard');
    showToast('Записи открыты. Вы справитесь вместе 💗');
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function openNotes() {
  try { await api('/api/open', { method: 'POST', body: '{}' }); renderEncouragement('hard'); showToast('Записи открыты для вас обоих.'); await refresh(); }
  catch (error) { showToast(error.message); }
}

async function finishCycle() {
  if (!window.confirm('Завершить текущий цикл и удалить все оставшиеся сладости и гадости — решённые и нерешённые? Это действие нельзя отменить.')) return;
  try { await api('/api/finish', { method: 'POST', body: '{}' }); renderEncouragement('calm'); showToast('Цикл завершён, записи удалены.'); await refresh(); }
  catch (error) { showToast(error.message); }
}

function switchView(view) {
  const mailboxViews = ['mailbox', 'conversation', 'homework', 'capsule'];
  const inMailbox = mailboxViews.includes(view);
  activeView = view;
  setActiveViewInfo(VIEW_INFO_KEYS[view] || 'mailbox');
  $$('.main-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === (inMailbox ? 'mailbox' : view)));
  $$('.mailbox-subtab').forEach((button) => button.classList.toggle('active', button.dataset.mailboxView === view));
  const mailboxSubnav = $('#mailboxSubnav');
  mailboxSubnav?.classList.toggle('hidden', !inMailbox);
  mailboxSubnav?.setAttribute('aria-hidden', String(!inMailbox));
  $$('.view').forEach((section) => section.classList.toggle('hidden', section.id !== `${view}View`));
  if (view !== 'games') pauseRunnerGame();
  clearInterval(gamePollTimer);
  gamePollTimer = null;
  if (view === 'games') {
    loadGame();
    gamePollTimer = setInterval(() => { if (activeView === 'games') loadGame(true); }, 6000);
  }
  if (view === 'conversation') refresh();
  if (view === 'homework') loadHomework();
  if (view === 'capsule') loadOurData();
  if (view === 'dates') loadIdeaLists('date');
  if (view === 'our') loadOurData();
}

async function drawIdea(kind, targetId, place = selectedDatePlace) {
  if (!place) { showToast('Сначала выберите настроение и место.'); return; }
  try {
    const result = await api(`/api/ideas?kind=${encodeURIComponent(kind)}&place=${encodeURIComponent(place)}&draw=1`);
    const target = $(`#${targetId}`);
    if (!result.idea) { target.textContent = 'В этой категории пока нет идей — добавьте свою 💗'; target.classList.remove('hidden'); return; }
    selectedDateIdea = { kind, place, text: String(result.idea.text || '').trim() };
    target.innerHTML = `<span><b class="idea-label">${kind === 'budget' ? 'Уютно' : 'Особенно'} · ${place === 'outside' ? 'Снаружи' : 'Внутри'}</b><br>${escapeHtml(selectedDateIdea.text)}</span>
      <div class="idea-decision">
        <button data-date-answer="yes">Наше 💗</button>
        <button data-date-answer="no">Дальше</button>
      </div>
      <button class="idea-again" data-draw-again="${escapeHtml(kind)}">Показать другую идею →</button>`;
    target.classList.remove('hidden', 'selected');
    target.querySelector('[data-draw-again]')?.addEventListener('click', () => drawIdea(kind, targetId, place));
    target.querySelector('[data-date-answer="yes"]')?.addEventListener('click', () => showDateYesForm(target));
    target.querySelector('[data-date-answer="no"]')?.addEventListener('click', () => showDateNoForm(target));
  } catch (error) { showToast(error.message); }
}

function showDateYesForm(target) {
  target.classList.add('selected');
  target.querySelector('.idea-decision').innerHTML = '<span>Оставляем эту идею видимой ✨</span>';
  target.querySelector('.idea-again')?.remove();
  const followup = document.createElement('div');
  followup.className = 'idea-followup';
  followup.innerHTML = `<label>Как прошло свидание? <textarea data-date-reflection maxlength="2000" placeholder="Что особенно понравилось, что запомнилось…" required></textarea></label>
    <label>Хотели бы повторить что-то подобное?
      <select data-date-repeat><option value="yes">Да, очень</option><option value="maybe">Возможно, немного изменив</option><option value="no">Пока нет</option></select>
    </label>
    <button class="button secondary" data-save-date>Сохранить в «Удавшиеся свидания»</button>`;
  target.appendChild(followup);
  followup.querySelector('[data-save-date]').addEventListener('click', () => saveDateHistory('completed', target));
}

function showDateNoForm(target) {
  target.classList.remove('selected');
  target.querySelector('.idea-decision').innerHTML = '<span>Ничего страшного — не каждая идея наша.</span>';
  target.querySelector('.idea-again')?.remove();
  const followup = document.createElement('div');
  followup.className = 'idea-followup';
  followup.innerHTML = `<label>Почему не подходит? <textarea data-date-reason maxlength="2000" placeholder="Слишком шумно, дорого, не хочется сегодня…" required></textarea></label>
    <label>Может, есть что-то лучшее? <input data-date-alternative maxlength="300" placeholder="Можно оставить пустым"></label>
    <button class="button secondary" data-save-date>Сохранить ответ и показать другую</button>`;
  target.appendChild(followup);
  followup.querySelector('[data-save-date]').addEventListener('click', () => saveDateHistory('declined', target));
}

async function saveDateHistory(status, target) {
  if (!selectedDateIdea) return;
  const field = target.querySelector(status === 'completed' ? '[data-date-reflection]' : '[data-date-reason]');
  const reflection = target.querySelector('[data-date-reflection]')?.value.trim() || '';
  const reason = target.querySelector('[data-date-reason]')?.value.trim() || '';
  const alternative = target.querySelector('[data-date-alternative]')?.value.trim() || '';
  if (status === 'completed' && reflection.length < 3) { showToast('Расскажите хотя бы пару слов о свидании 💗'); field?.focus(); return; }
  if (status === 'declined' && reason.length < 3) { showToast('Напишите, почему идея не подошла — это поможет выбрать лучше.'); field?.focus(); return; }
  try {
    await api('/api/date-history', { method: 'POST', body: JSON.stringify({ kind: selectedDateIdea.kind, place: selectedDateIdea.place, idea: selectedDateIdea.text, status, reason, alternative, reflection, repeat: target.querySelector('[data-date-repeat]')?.value === 'yes' }) });
    if (status === 'declined') {
      await api('/api/ideas', { method: 'POST', body: JSON.stringify({ kind: selectedDateIdea.kind, place: selectedDateIdea.place, text: selectedDateIdea.text, hidden: true }) });
    }
    if (status === 'completed') {
      target.querySelector('.idea-followup').innerHTML = '<div class="idea-no-message">Сохранила вашу маленькую историю в «Удавшиеся свидания» 🌟 Можно перечитать её в любой момент.</div>';
      showToast('Свидание сохранено в вашу историю 🌟');
      showToast(`Новая ачивка: ${ACHIEVEMENT_LABELS.date_together} ✦`);
      await loadSuccessfulDates();
      await refresh();
    } else {
      target.querySelector('.idea-followup').innerHTML = `<div class="idea-no-message">Спасибо, теперь понятно, что не подошло. ${alternative ? 'Попробуйте учесть вашу идею: ' + escapeHtml(alternative) : 'Давайте найдём что-то мягче.'}</div><button class="button secondary" data-new-date-idea>Показать другой вариант</button>`;
      target.querySelector('[data-new-date-idea]').addEventListener('click', () => drawIdea(selectedDateIdea.kind, 'dateIdeaResult', selectedDateIdea.place));
      showToast('Ничего страшного — в другой раз будет лучше 🤍');
      await refresh();
    }
  } catch (error) { showToast(error.message); }
}

async function loadSuccessfulDates() {
  try {
    const result = await api('/api/date-history');
    const target = $('#successfulDatesList');
    const dates = result.dates || [];
    target.innerHTML = dates.length
      ? dates.map((item) => `<article class="successful-date-card"><div class="date-meta">${escapeHtml(prettyDate(item.created_at))} · ${item.kind === 'budget' ? 'Уютно' : 'Особенно'} · ${item.place === 'outside' ? 'Снаружи' : 'Внутри'}</div><h4>${item.kind === 'budget' ? '🌷' : '✨'} ${escapeHtml(item.idea)}</h4><p>${escapeHtml(item.reflection)}</p>${item.repeat ? '<span class="repeat-mark">хочется повторить</span>' : ''}</article>`).join('')
      : '<article class="successful-date-card"><p>Здесь пока пусто. Сначала выберите идею и расскажите, как всё прошло 💗</p></article>';
  } catch (error) { showToast(error.message); }
}

const AGREEMENT_STATUS_LABELS = { try: 'Попробуем', working: 'В процессе', done: 'Получается', revisit: 'Обсудить ещё' };

async function loadOurData() {
  const results = await Promise.allSettled([
    api('/api/decisions'), api('/api/agreements'), api('/api/capsule'), api('/api/wishes?kind=general'), api('/api/wishes?kind=intimate'),
  ]);
  const [decisions, agreements, capsule, wishes, intimateWishes] = results;
  if (decisions.status === 'fulfilled') renderDecisions(decisions.value.options || [], decisions.value.types || DEFAULT_DECISION_TYPES);
  if (agreements.status === 'fulfilled') renderAgreements(agreements.value.agreements || []);
  if (capsule.status === 'fulfilled') renderCapsule(capsule.value.entries || []);
  if (wishes.status === 'fulfilled') renderWishes(wishes.value, 'general');
  if (intimateWishes.status === 'fulfilled') renderWishes(intimateWishes.value, 'intimate');
  const failed = results.find((result) => result.status === 'rejected');
  if (failed && !failed.reason?.message?.includes('Сначала войдите')) showToast(failed.reason?.message || 'Не удалось загрузить раздел «Наше».');
}

function renderCapsule(entries) {
  const list = $('#capsuleList');
  list.innerHTML = entries.length
    ? entries.map((item) => `<div class="our-list-row"><span>${escapeHtml(item.text || item.body)}</span><button data-delete-capsule="${item.id}" title="Удалить">×</button></div>`).join('')
    : '<p class="small-note">Капсула пока пустая. Сохраните туда сладость или добавьте что-то тёплое.</p>';
  list.querySelectorAll('[data-delete-capsule]').forEach((button) => button.addEventListener('click', async () => {
    await api(`/api/capsule?id=${button.dataset.deleteCapsule}`, { method: 'DELETE' });
    await loadOurData();
  }));
}

async function openCapsule() {
  try {
    const result = await api('/api/capsule?draw=1');
    const target = $('#capsuleResult');
    target.classList.remove('hidden');
    target.textContent = result.entry ? `💌 ${result.entry.text || result.entry.body}` : 'Капсула пока пустая — здесь обязательно появится что-то хорошее.';
  } catch (error) { showToast(error.message); }
}

function renderAgreements(items) {
  const target = $('#agreementsList');
  target.innerHTML = items.length
    ? items.map((item) => `<div class="agreement-row"><span>${escapeHtml(item.text || item.body)}</span><select data-agreement-status="${item.id}">${Object.entries(AGREEMENT_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select><button data-delete-agreement="${item.id}" title="Удалить">×</button></div>`).join('')
    : '<p class="small-note">Здесь будут маленькие решения, которые вы захотите попробовать вместе.</p>';
  target.querySelectorAll('[data-agreement-status]').forEach((select) => select.addEventListener('change', async () => {
    await api(`/api/agreements?id=${select.dataset.agreementStatus}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
    showToast('Статус договорённости обновлён.');
  }));
  target.querySelectorAll('[data-delete-agreement]').forEach((button) => button.addEventListener('click', async () => {
    await api(`/api/agreements?id=${button.dataset.deleteAgreement}`, { method: 'DELETE' }); await loadOurData();
  }));
}

function renderDecisionSelectors(types = DEFAULT_DECISION_TYPES) {
  const selects = [$('#decisionKind'), $('#decisionForm select[name="kind"]')].filter(Boolean);
  const previous = selects.map((select) => select.value);
  const html = types.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`).join('');
  selects.forEach((select, index) => {
    select.innerHTML = html;
    select.value = types.some((item) => item.key === previous[index]) ? previous[index] : (types[0]?.key || 'food');
  });
}

function decisionTypeLabel(kind, types = DEFAULT_DECISION_TYPES) {
  return types.find((item) => item.key === kind)?.label || 'Тип решения';
}

function renderDecisions(items, types = DEFAULT_DECISION_TYPES) {
  renderDecisionSelectors(types);
  const target = $('#decisionsList');
  target.innerHTML = items.length
    ? items.map((item) => `<div class="our-list-row decision-option-row"><span><b class="decision-option-kind">${escapeHtml(decisionTypeLabel(item.kind, types))}</b>${escapeHtml(item.text || item.body)}</span>${item.builtin ? `<em class="decision-builtin">котик</em><button data-delete-decision="${item.id}" title="Убрать вариант котика">×</button>` : (item.mine ? `<button data-delete-decision="${item.id}" title="Удалить свой вариант">×</button>` : '')}</div>`).join('')
    : '<p class="small-note">Добавьте свои варианты, между которыми трудно выбрать.</p>';
  target.querySelectorAll('[data-delete-decision]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/api/decisions?id=${button.dataset.deleteDecision}`, { method: 'DELETE' });
      showToast('Свой вариант убран из мешочка.');
      await loadOurData();
    } catch (error) { showToast(error.message); }
  }));
}

function renderWishRows(items, mine, kind, hiddenList = false) {
  if (!items.length) return `<p class="small-note">${mine ? (hiddenList ? 'Скрытых желаний нет.' : 'Здесь пока пусто — добавьте первое желание.') : 'Партнёр пока ничего не добавил.'}</p>`;
  return items.map((item) => {
    const status = item.received ? 'Уже получено ✓' : (mine ? 'Пока хочется' : 'Ещё хочется');
    const visibilityLabel = item.is_hidden ? (kind === 'intimate' ? 'Открыть партнёру' : 'Вернуть на экран') : 'Скрыть';
    const actionButtons = mine
      ? `<div class="wish-row-actions">
          <button type="button" data-wish-received="${item.id}" data-wish-kind="${kind}">${item.received ? 'Вернуть в список' : 'Отметить полученным'}</button>
          <button type="button" data-wish-hidden="${item.id}" data-wish-kind="${kind}">${visibilityLabel}</button>
          <button type="button" class="wish-delete" data-wish-delete="${item.id}" data-wish-kind="${kind}" title="Удалить своё желание">×</button>
        </div>`
      : '';
    return `<article class="wish-row${item.received ? ' received' : ''}">
      <div class="wish-row-text">${escapeHtml(item.text || item.body)}</div>
      <div class="wish-row-meta">${status}${item.is_hidden && mine ? ' · убрано с экрана' : ''}</div>
      ${actionButtons}
    </article>`;
  }).join('');
}

function renderWishes(result, kind = 'general') {
  const intimate = kind === 'intimate';
  const prefix = intimate ? 'intimateWish' : 'wish';
  const mineList = $(`#${prefix}MineList`);
  const partnerList = $(`#${prefix}PartnerList`);
  const hiddenList = $(`#${prefix}HiddenList`);
  const hiddenDetails = $(`#${prefix}HiddenDetails`);
  if (!mineList || !partnerList || !hiddenList || !hiddenDetails) return;
  const mineTitle = $(`#${prefix}MineTitle`);
  const partnerTitle = $(`#${prefix}PartnerTitle`);
  const hint = $(`#${prefix}Hint`);
  const allMine = result.mine || [];
  const visibleMine = allMine.filter((item) => !item.is_hidden);
  const hiddenMine = allMine.filter((item) => item.is_hidden);
  if (mineTitle) mineTitle.textContent = result.mine_name ? `Мои желания · ${result.mine_name}` : 'Мои желания';
  if (partnerTitle) partnerTitle.textContent = result.partner_name ? `Партнёр · ${result.partner_name}` : 'Желания партнёра';
  mineList.innerHTML = renderWishRows(visibleMine, true, kind);
  hiddenList.innerHTML = renderWishRows(hiddenMine, true, kind, true);
  hiddenDetails.classList.toggle('hidden', !hiddenMine.length);
  partnerList.innerHTML = renderWishRows(result.partner || [], false, kind);
  const hiddenCount = Number(result.partner_hidden_count || 0);
  const ownHiddenText = hiddenMine.length ? ` Скрытых у тебя: ${hiddenMine.length} — их можно вернуть через «Показать скрытые».` : '';
  if (hint) {
    hint.textContent = hiddenCount
      ? `У партнёра есть ${hiddenCount} скрытое желание — оно появится здесь, когда его откроют.${ownHiddenText}`
      : `${intimate ? 'Каждое желание можно скрыть с экрана или открыть снова.' : 'Свои желания можно скрывать, удалять и отмечать полученными.'}${ownHiddenText}`;
  }
  [mineList, hiddenList, partnerList].forEach((list) => {
    list.querySelectorAll('[data-wish-received]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const item = allMine.find((wish) => String(wish.id) === String(button.dataset.wishReceived));
        await api(`/api/wishes?id=${button.dataset.wishReceived}`, { method: 'PATCH', body: JSON.stringify({ received: !item?.received }) });
        await loadWishes(kind);
      } catch (error) { showToast(error.message); }
    }));
    list.querySelectorAll('[data-wish-hidden]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const item = allMine.find((wish) => String(wish.id) === String(button.dataset.wishHidden));
        await api(`/api/wishes?id=${button.dataset.wishHidden}`, { method: 'PATCH', body: JSON.stringify({ is_hidden: !item?.is_hidden }) });
        await loadWishes(kind);
      } catch (error) { showToast(error.message); }
    }));
    list.querySelectorAll('[data-wish-delete]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await api(`/api/wishes?id=${button.dataset.wishDelete}`, { method: 'DELETE' });
        showToast('Желание удалено.');
        await loadWishes(kind);
      } catch (error) { showToast(error.message); }
    }));
  });
}

async function loadWishes(kind = 'general') {
  try {
    const result = await api(`/api/wishes?kind=${encodeURIComponent(kind)}`);
    renderWishes(result, kind);
  } catch (error) {
    if (!error.message.includes('Сначала войдите')) showToast(error.message);
  }
}

async function addWish(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const kind = form.dataset.wishKind || 'general';
  const text = String(new FormData(form).get('text') || '').trim();
  try {
    await api(`/api/wishes?kind=${encodeURIComponent(kind)}`, { method: 'POST', body: JSON.stringify({ text, kind }) });
    form.reset();
    showToast(kind === 'intimate' ? 'Сексуальное желание сохранено — пока оно скрыто 🔒' : 'Желание сохранено 💗');
    await loadWishes(kind);
  } catch (error) { showToast(error.message); }
}

async function addOurItem(event, endpoint) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const text = String(data.text || '').trim();
  try {
    const payload = endpoint === '/api/capsule' ? { body: text } : { text };
    if (endpoint === '/api/decisions') payload.kind = data.kind || $('#decisionKind')?.value || DEFAULT_DECISION_TYPES[0].key;
    await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    if (endpoint === '/api/decisions') renderDecisionSelectors();
    renderEncouragement('calm');
    showToast('Сохранила для вас двоих 💗');
    await loadOurData();
  } catch (error) { showToast(error.message); }
}

async function chooseDecision() {
  const kind = $('#decisionKind')?.value || DEFAULT_DECISION_TYPES[0].key;
  try {
    const result = await api('/api/decisions', { method: 'POST', body: JSON.stringify({ action: 'choose', kind }) });
    const target = $('#decisionResult');
    target.classList.remove('hidden');
    $('#decisionOptionsDetails')?.classList.remove('hidden');
    target.innerHTML = result.choice
      ? `<strong>Котик выбрал:</strong> ${escapeHtml(result.choice.text)}<small>Тип: ${escapeHtml(result.type?.label || 'решение')}</small>`
      : 'Для этого типа пока нет вариантов.';
    const button = $('#chooseDecisionButton');
    if (button) button.textContent = 'Выбрать ещё раз 🎲';
    renderEncouragement('calm');
    showToast('Котик выбрал вариант 🎲');
  } catch (error) { showToast(error.message); }
}

function ideaKindLabel(kind) {
  return kind === 'budget' ? 'Уютно' : 'Особенно';
}

function ideaPlaceLabel(place) {
  return place === 'outside' ? 'Снаружи' : 'Внутри';
}

async function loadIdeaLists(area) {
  if (area !== 'date') return;
  const config = [
    { kind: 'budget', place: 'outside' }, { kind: 'budget', place: 'inside' },
    { kind: 'treat', place: 'outside' }, { kind: 'treat', place: 'inside' },
  ];
  const rows = [];
  try {
    for (const item of config) {
      const result = await api(`/api/ideas?kind=${item.kind}&place=${item.place}&list=1`);
      (result.ideas || []).forEach((idea) => rows.push({ ...idea, kind: item.kind, place: item.place }));
    }
    const target = $('#dateIdeasList');
    target.innerHTML = rows.length
      ? rows.map((idea) => `<div class="custom-idea-row"><span><b>${escapeHtml(ideaKindLabel(idea.kind))} · ${escapeHtml(ideaPlaceLabel(idea.place))}:</b> ${escapeHtml(idea.text)}</span>${idea.mine ? `<button title="Удалить свою идею" data-delete-idea="${idea.id}">×</button>` : ''}</div>`).join('')
      : '<p class="small-note">Ваших добавленных идей пока нет. Список случайных идей уже ждёт внутри кнопки.</p>';
    target.querySelectorAll('[data-delete-idea]').forEach((button) => button.addEventListener('click', async () => {
      try { await api(`/api/ideas?id=${button.dataset.deleteIdea}`, { method: 'DELETE' }); await loadIdeaLists('date'); showToast('Идея убрана из мешочка.'); }
      catch (error) { showToast(error.message); }
    }));
  } catch (error) { showToast(error.message); }
}

async function addIdea(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/api/ideas', { method: 'POST', body: JSON.stringify({ kind: data.kind, place: data.place, text: data.text }) });
    form.reset();
    showToast('Идея спрятана в общий мешочек 💗');
    await loadIdeaLists('date');
  } catch (error) { showToast(error.message); }
}

async function savePin(event) {
  event.preventDefault();
  const pin = new FormData(event.currentTarget).get('pin');
  try {
    await api('/api/pin', { method: 'POST', body: JSON.stringify({ pin }) });
    event.currentTarget.reset();
    showToast('PIN сохранён. Теперь можно вернуться в этот же ящик.');
    await refresh();
  } catch (error) { showToast(error.message); }
}

async function requestNotifications() {
  if (!('Notification' in window)) { showToast('Этот браузер не поддерживает уведомления.'); return; }
  const permission = await Notification.requestPermission();
  showToast(permission === 'granted' ? 'Уведомления разрешены.' : 'Уведомления пока отключены в браузере.');
}

const RELATIONSHIP_START = { year: 2025, month: 2, day: 26 };
const ANNIVERSARY_MONTH = 2;
const ANNIVERSARY_DAY = 26;
const ANNIVERSARY_PROMPT_DAYS = 45;

function russianPlural(value, one, few, many) {
  const number = Math.abs(value) % 100;
  if (number >= 11 && number <= 14) return many;
  const last = number % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function relationshipDuration(now = new Date()) {
  let totalMonths = (now.getFullYear() - RELATIONSHIP_START.year) * 12
    + (now.getMonth() - RELATIONSHIP_START.month);
  if (now.getDate() < RELATIONSHIP_START.day) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years) parts.push(`${years} ${russianPlural(years, 'год', 'года', 'лет')}`);
  if (months) parts.push(`${months} ${russianPlural(months, 'месяц', 'месяца', 'месяцев')}`);
  return parts.length ? parts.join(' и ') : 'меньше месяца';
}

function anniversaryInfo(now = new Date()) {
  const anniversaryThisYear = new Date(now.getFullYear(), ANNIVERSARY_MONTH, ANNIVERSARY_DAY, 0, 0, 0, 0);
  const isAnniversaryToday = now.getMonth() === ANNIVERSARY_MONTH && now.getDate() === ANNIVERSARY_DAY;
  const nextYear = isAnniversaryToday || now > anniversaryThisYear ? now.getFullYear() + 1 : now.getFullYear();
  const next = new Date(nextYear, ANNIVERSARY_MONTH, ANNIVERSARY_DAY, 0, 0, 0, 0);
  const milliseconds = Math.max(0, next.getTime() - now.getTime());
  const days = Math.floor(milliseconds / 86400000);
  const hours = Math.floor((milliseconds % 86400000) / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const calendarDays = Math.max(0, Math.ceil((Date.UTC(next.getFullYear(), ANNIVERSARY_MONTH, ANNIVERSARY_DAY) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
  return {
    next,
    isAnniversaryToday,
    days,
    hours,
    minutes,
    seconds,
    calendarDays,
    duration: relationshipDuration(now),
    isNear: isAnniversaryToday || calendarDays <= ANNIVERSARY_PROMPT_DAYS,
  };
}

function renderAnniversary() {
  const lead = $('#anniversaryLead');
  const countdown = $('#anniversaryDays');
  const countdownLabel = $('#anniversaryCountdownLabel');
  const callout = $('#anniversaryCallout');
  const planText = $('#anniversaryPlanText');
  const button = $('#anniversaryButton');
  if (!lead || !countdown || !countdownLabel) return;
  const info = anniversaryInfo();
  const pad = (value) => String(value).padStart(2, '0');
  lead.textContent = `Вы вместе ${info.duration} — с 26.03.2025.`;
  countdown.textContent = info.isAnniversaryToday
    ? 'Сегодня ваш день 💗'
    : `${info.days} дн. ${pad(info.hours)} ч. ${pad(info.minutes)} мин.`;
  countdownLabel.textContent = info.isAnniversaryToday ? 'с годовщиной!' : 'до ближайшего 26 марта';
  callout?.classList.toggle('hidden', !info.isNear);
  if (planText) {
    planText.textContent = info.isNear
      ? 'Пора праздновать и планировать: выберите маленький ритуал или сохраните идею для годовщины.'
      : 'Можно заранее выбрать настроение, придумать маленький ритуал и сохранить идею для вашего 26 марта.';
  }
  button?.classList.toggle('anniversary-near', info.isNear);
}

function renderAnniversaryIdeaRows(items, hidden = false) {
  if (!items.length) return `<p class="small-note">${hidden ? 'Скрытых идей пока нет.' : 'Идей для годовщины пока нет — добавьте первую.'}</p>`;
  return items.map((item) => `<article class="anniversary-idea-row${hidden ? ' is-hidden' : ''}">
    <span>${escapeHtml(item.text || item.body)}</span>
    <small>${escapeHtml(item.author || 'Кто-то из вас')}</small>
    ${item.mine ? `<div class="anniversary-idea-actions"><button type="button" data-anniversary-toggle="${item.id}">${hidden ? 'Вернуть' : 'Скрыть'}</button><button type="button" data-anniversary-delete="${item.id}" title="Удалить свою идею">×</button></div>` : ''}
  </article>`).join('');
}

function renderAnniversaryIdeas(result) {
  const visible = $('#anniversaryIdeasList');
  const hidden = $('#anniversaryHiddenIdeasList');
  const details = $('#anniversaryHiddenIdeasDetails');
  if (!visible || !hidden || !details) return;
  const activeIdeas = result.ideas || [];
  const hiddenIdeas = result.hidden || [];
  visible.innerHTML = renderAnniversaryIdeaRows(activeIdeas);
  hidden.innerHTML = renderAnniversaryIdeaRows(hiddenIdeas, true);
  details.classList.toggle('hidden', !hiddenIdeas.length);
  const allIdeas = [...activeIdeas, ...hiddenIdeas];
  [visible, hidden].forEach((list) => {
    list.querySelectorAll('[data-anniversary-toggle]').forEach((button) => button.addEventListener('click', async () => {
      const item = allIdeas.find((idea) => String(idea.id) === String(button.dataset.anniversaryToggle));
      try {
        await api(`/api/anniversary-ideas?id=${button.dataset.anniversaryToggle}`, { method: 'PATCH', body: JSON.stringify({ is_hidden: !item?.is_hidden }) });
        await loadAnniversaryIdeas();
      } catch (error) { showToast(error.message); }
    }));
    list.querySelectorAll('[data-anniversary-delete]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await api(`/api/anniversary-ideas?id=${button.dataset.anniversaryDelete}`, { method: 'DELETE' });
        showToast('Идея для годовщины удалена.');
        await loadAnniversaryIdeas();
      } catch (error) { showToast(error.message); }
    }));
  });
}

async function loadAnniversaryIdeas() {
  try {
    renderAnniversaryIdeas(await api('/api/anniversary-ideas'));
  } catch (error) {
    if (!error.message.includes('Сначала войдите')) showToast(error.message);
  }
}

async function saveAnniversaryIdea(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const text = String(new FormData(form).get('text') || '').trim();
  try {
    await api('/api/anniversary-ideas', { method: 'POST', body: JSON.stringify({ text }) });
    form.reset();
    showToast('Идея для годовщины сохранена ✨');
    await loadAnniversaryIdeas();
  } catch (error) { showToast(error.message); }
}

function checkReminder() {
  const scheduled = appState?.scheduled_date || appState?.scheduled_for;
  if (!scheduled || appState.opened) return;
  const due = dateKey(scheduled) <= localDateKeyNow();
  const key = dateKey(scheduled);
  if (due && key !== lastReminderKey) {
    lastReminderKey = key;
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Тихий ящик', { body: 'Сегодня можно поговорить. Один из вас может открыть записи.' });
    showToast('Сегодня ваш день разговора. Записи можно открыть.');
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast('Скопировано.'); }
  catch { showToast('Не получилось скопировать — выдели код вручную.'); }
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.querySelector('textarea, input')?.focus();
}

function closeModal(id) {
  $(`#${id}`)?.classList.add('hidden');
}


const INFO_CONTENT = {
  mailbox: {
    title: 'Ящик',
    lines: ['Сохраняйте важные мысли до общего разговора.', 'Сладости и гадости остаются личными до выбранного дня.'],
  },
  conversation: {
    title: 'Разговор',
    lines: ['Выберите день, когда записи откроются обоим, или откройте их сейчас.', 'После разговора можно отметить итог и завершить цикл.'],
  },
  homework: {
    title: 'Домашнее задание',
    lines: ['Здесь живут маленькие договорённости после сложного разговора.', 'Ответы сохраняются отдельно для каждого из вас.'],
  },
  capsule: {
    title: 'Капсула тепла',
    lines: ['Собирайте добрые слова и открывайте их, когда хочется поддержки.'],
  },
  dates: {
    title: 'Свидания',
    lines: ['Выберите настроение и место — ящик предложит идею для вас двоих.', 'Удачные свидания можно сохранить в историю.'],
  },
  datesHistory: {
    title: 'Удавшиеся свидания',
    lines: ['Здесь остаются ваши понравившиеся идеи и впечатления после них.'],
  },
  our: {
    title: 'Наше',
    lines: ['Это место для общих решений, договорённостей и желаний.', 'Каждый список можно пополнять вместе.'],
  },
  partnerProfile: {
    title: 'Карточка партнёра',
    lines: ['Это личные заметки о партнёре: их видите и меняете только вы.', 'Можно спросить: какой цвет, блюдо или музыка сейчас радуют? Когда день рождения? О чём мечтается? Что помогает после трудного дня?'],
  },
  games: {
    title: 'Игры',
    lines: ['Три мини-игры для вас двоих. У каждой игры есть своё маленькое пиксельное сердечко с правилами.'],
  },
  truths: {
    title: 'Две правды и одна мечта',
    lines: ['Загадайте две правды и одну мечту. Партнёр выбирает карточку с мечтой.', 'За правильную разгадку начисляется очко; историю можно сбросить.'],
  },
  runner: {
    title: 'Любимое село',
    lines: ['Бесконечный забег коровки по полю: начинайте спокойно, скорость растёт сама.', 'Тап по полю, пробел или ↑ — прыжок; доступен двойной прыжок. Перепрыгивайте камень, бычка и дерево, собирайте травку, молоко и ботинки.', 'Жизнь одна. Рекорд сохраняется автоматически отдельно у каждого авторизованного человека.'],
  },
  tictactoe: {
    title: 'Крестики-нолики',
    lines: ['Обычное поле 3 × 3: поставленные знаки остаются на месте до конца партии.', 'Три знака в ряд приносят победу, а заполненное поле без линии — ничью. Слева всегда ваши очки, справа — очки соперника. В онлайн-режиме роли и ход определяются по входу в ящик.'],
  },
};

const VIEW_INFO_KEYS = {
  mailbox: 'mailbox',
  conversation: 'conversation',
  homework: 'homework',
  capsule: 'capsule',
  dates: 'dates',
  our: 'our',
  games: 'games',
};

// The reusable button travels into the card it explains instead of making a separate row under navigation.
const INFO_HOSTS = {
  mailbox: '#mailboxView .write-card',
  conversation: '#conversationView .date-controls-card',
  homework: '#homeworkView #homeworkCard:not(.hidden), #homeworkView #homeworkEmpty',
  capsule: '#capsuleView .capsule-card',
  dates: '#dateRandomPanel .ideas-hero',
  datesHistory: '#successfulDatesPanel .successful-intro',
  our: '#ourView .decisions-card',
  games: null, // Each game has its own i button in its card heading.
};

function mountActiveViewInfo(key) {
  const button = $('#activeViewInfoBtn');
  if (!button) return;
  const host = INFO_HOSTS[key] ? $(INFO_HOSTS[key]) : null;
  if (!host) {
    button.classList.add('hidden');
    return;
  }
  host.classList.add('info-card-host');
  host.append(button);
  button.classList.remove('hidden');
}

function setActiveViewInfo(key) {
  const safeKey = key in INFO_CONTENT ? key : 'mailbox';
  const entry = INFO_CONTENT[safeKey];
  const button = $('#activeViewInfoBtn');
  if (!button) return;
  button.dataset.infoKey = safeKey;
  button.setAttribute('aria-label', `Открыть подсказку: ${entry.title}`);
  button.title = entry.title;
  mountActiveViewInfo(safeKey);
}

function openInfoModal(key) {
  const entry = INFO_CONTENT[key] || INFO_CONTENT.mailbox;
  const title = $('#infoTitle');
  const body = $('#infoModalBody');
  if (!title || !body) return;
  title.textContent = entry.title;
  body.replaceChildren(...entry.lines.map((line) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    return paragraph;
  }));
  openModal('infoModal');
}

function renderFeedback(items) {
  const target = $('#feedbackList');
  if (!target) return;
  target.innerHTML = items.length
    ? items.map((item) => `<div class="feedback-row"><span>${escapeHtml(item.text || item.body)}</span>${item.mine ? `<button data-delete-feedback="${item.id}" title="Удалить">×</button>` : ''}</div>`).join('')
    : '<p class="small-note">Здесь пока пусто. Запишите идею, чтобы не потерять её.</p>';
  target.querySelectorAll('[data-delete-feedback]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/api/feedback?id=${button.dataset.deleteFeedback}`, { method: 'DELETE' });
      await loadFeedback();
    } catch (error) { showToast(error.message); }
  }));
}

async function loadFeedback() {
  try {
    const result = await api('/api/feedback');
    renderFeedback(result.ideas || []);
  } catch (error) { showToast(error.message); }
}

async function saveFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const text = String(new FormData(form).get('text') || '').trim();
  if (!text) return;
  try {
    await api('/api/feedback', { method: 'POST', body: JSON.stringify({ text }) });
    form.reset();
    renderEncouragement('calm');
    showToast('Идея сохранена, не потеряется 💡');
    await loadFeedback();
  } catch (error) { showToast(error.message); }
}

const CAT_PIECE_SVG = `<svg viewBox="0 0 120 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="tttCatGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffb8dc"/>
      <stop offset="100%" stop-color="#c8b0f6"/>
    </linearGradient>
  </defs>
  <path d="M18 48 L24 14 Q26 9 31 14 L47 28 Q60 22 73 28 L89 14 Q94 9 96 15 L102 48 Q105 86 60 92 Q15 86 18 48Z" fill="url(#tttCatGrad)" stroke="#9e6bc0" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M28 24 L31 38 L42 32Z M92 24 L89 38 L78 32Z" fill="#f288be"/>
  <path d="M40 53 Q46 46 52 53 M68 53 Q74 46 80 53" fill="none" stroke="#63325c" stroke-width="3.2" stroke-linecap="round"/>
  <ellipse cx="35" cy="63" rx="8" ry="4.2" fill="#eb82b5" opacity=".55"/>
  <ellipse cx="85" cy="63" rx="8" ry="4.2" fill="#eb82b5" opacity=".55"/>
  <path d="M57 59 Q60 56 63 59 L60 63Z" fill="#9a4b82"/>
  <path d="M60 63 Q56 70 51 66 M60 63 Q64 70 69 66 M38 62 L21 59 M38 67 L21 70 M82 62 L99 59 M82 67 L99 70" fill="none" stroke="#63325c" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const HEART_PIECE_SVG = `<svg viewBox="0 0 120 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="tttHeartGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff65b0"/>
      <stop offset="55%" stop-color="#e374e8"/>
      <stop offset="100%" stop-color="#b68cf6"/>
    </linearGradient>
  </defs>
  <path d="M60 94 C60 94 16 66 16 37 C16 20 30 12 44 16 C52 18 57 24 60 30 C63 24 68 18 76 16 C90 12 104 20 104 37 C104 66 60 94 60 94Z" fill="url(#tttHeartGrad)" stroke="#9e529f" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M34 30 Q40 23 48 27" fill="none" stroke="#fff2fa" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
  <circle cx="95" cy="20" r="3.5" fill="#ff8ac6"/>
  <path d="M22 82 L24 76 L26 82 L32 84 L26 86 L24 92 L22 86 L16 84Z" fill="#cba8f5"/>
</svg>`;

let activeGameSubtab = 'truths';
let truthHintCursor = -1;
let latestGamesData = null;

function switchGameSubtab(tab) {
  const nextTab = GAME_TABS[tab] ? tab : 'truths';
  if (activeGameSubtab === 'runner' && nextTab !== 'runner') pauseRunnerGame();
  activeGameSubtab = nextTab;
  $$('.game-subtab').forEach((btn) => btn.classList.toggle('active', btn.dataset.gameSubtab === activeGameSubtab));
  $('#gameTruthsPanel')?.classList.toggle('hidden', activeGameSubtab !== 'truths');
  $('#gameRunnerPanel')?.classList.toggle('hidden', activeGameSubtab !== 'runner');
  $('#gameTictactoePanel')?.classList.toggle('hidden', activeGameSubtab !== 'tictactoe');
  if (activeGameSubtab === 'runner' && !runnerGame.running) drawRunnerStatic();
  if (activeGameSubtab === 'tictactoe') renderTicTacToe();
}

function showNextTruthTopicHint() {
  truthHintCursor = (truthHintCursor + 1) % TRUTH_TOPIC_HINTS.length;
  const banner = $('#truthTopicHint');
  if (!banner) return;
  banner.classList.remove('hidden');
  banner.textContent = `💡 Идея темы: «${TRUTH_TOPIC_HINTS[truthHintCursor]}»`;
}

function renderTruthsSection(truthsData = {}) {
  const scoreBadge = $('#truthsScoreBadge');
  const activeArea = $('#truthsActiveArea');
  const historyList = $('#truthsHistoryList');
  if (!activeArea || !historyList) return;

  const myName = appState?.user?.name || 'Яночкин';
  const partnerName = appState?.partner?.name || 'Саняня';
  const mineScore = Number(truthsData.scores?.mine || 0);
  const partnerScore = Number(truthsData.scores?.partner || 0);
  if (scoreBadge) {
    scoreBadge.textContent = `Угадано мечт: ${myName} — ${mineScore} · ${partnerName} — ${partnerScore}`;
  }

  const rounds = Array.isArray(truthsData.rounds) ? truthsData.rounds : [];
  const pending = rounds.filter((r) => !r.completed_at);
  const completed = rounds.filter((r) => r.completed_at);

  // Preserve checked radio if user is currently selecting
  const checkedByRound = {};
  activeArea.querySelectorAll('input[type="radio"]:checked').forEach((inp) => {
    checkedByRound[inp.name] = inp.value;
  });

  if (!pending.length) {
    const latestDone = completed[0];
    activeArea.innerHTML = latestDone
      ? renderCompletedTruthRound(latestDone, true)
      : `<div class="game-start">
          <div class="game-start-icon" aria-hidden="true">💌</div>
          <h4>Активных загадок пока нет</h4>
          <p>Напиши ниже две свои правды и одну мечту — карточки перемешаются, и партнёр сможет отгадать их!</p>
        </div>`;
  } else {
    activeArea.innerHTML = pending.map((round) => {
      const radioName = `truthGuess_${round.id}`;
      const prevVal = checkedByRound[radioName];
      const optionsHtml = (round.options || []).map((opt, idx) => {
        const isChecked = prevVal !== undefined && Number(prevVal) === idx;
        return `<label class="truths-option-label">
          <input type="radio" name="${radioName}" value="${idx}" ${isChecked ? 'checked' : ''}>
          <span>${escapeHtml(opt)}</span>
          <span class="truths-option-tag">${isChecked ? '✨ Это мечта' : 'Правда?'}</span>
        </label>`;
      }).join('');
      return `<article class="truths-round-card" data-truth-round="${round.id}">
        <div class="truths-round-header">
          <span class="truths-round-author">💌 Загадал(а): ${escapeHtml(round.author_name)}</span>
          <button class="quiet-button" type="button" data-truth-delete="${round.id}" title="Удалить раунд">Удалить ×</button>
        </div>
        <p class="small-note">${round.is_author
          ? 'Ты загадал(а) этот раунд. Партнёр может отгадать со своего устройства или прямо здесь:'
          : 'Два утверждения — чистая правда, а одно — мечта. Отметь карточку, где спрятана МЕЧТА:'}</p>
        <div class="truths-options-list">${optionsHtml}</div>
        <button class="button primary" type="button" data-truth-submit="${round.id}">Проверить: где мечта? ✨</button>
      </article>`;
    }).join('');
  }

  activeArea.querySelectorAll('.truths-option-label input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const card = radio.closest('.truths-round-card');
      card?.querySelectorAll('.truths-option-label').forEach((lbl) => {
        const inp = lbl.querySelector('input');
        const tag = lbl.querySelector('.truths-option-tag');
        if (tag) tag.textContent = inp?.checked ? '✨ Это мечта' : '✅ Правда';
      });
    });
  });

  activeArea.querySelectorAll('[data-truth-submit]').forEach((btn) => {
    btn.addEventListener('click', () => submitTruthGuess(Number(btn.dataset.truthSubmit)));
  });
  activeArea.querySelectorAll('[data-truth-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTruthRound(Number(btn.dataset.truthDelete)));
  });

  historyList.innerHTML = completed.length
    ? completed.map((r) => renderCompletedTruthRound(r, false)).join('')
    : '<p class="small-note">Пока нет завершённых раундов.</p>';
  const resetButton = $('#truthsResetBtn');
  if (resetButton) resetButton.disabled = !rounds.length;
  historyList.querySelectorAll('[data-truth-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTruthRound(Number(btn.dataset.truthDelete)));
  });
}

function renderCompletedTruthRound(round, isBanner) {
  const items = (round.options || []).map((text, idx) => {
    const isDream = idx === Number(round.dream_index);
    const wasPicked = idx === Number(round.guessed_index);
    return `<div class="truths-reveal-item ${isDream ? 'is-dream' : ''}">
      <span>${escapeHtml(text)}${wasPicked ? ' <b>(выбрано)</b>' : ''}</span>
      <span class="truth-badge ${isDream ? 'dream' : 'truth'}">${isDream ? '✨ Мечта' : '✅ Правда'}</span>
    </div>`;
  }).join('');
  return `<article class="truths-round-card">
    <div class="truths-round-header">
      <span class="truths-round-author">${round.is_correct ? '🎉 Мечта угадана!' : '💭 Мечта оказалась в другой карточке'} · автор: ${escapeHtml(round.author_name)}</span>
      ${isBanner ? '<span class="small-note">Последний разбор</span>' : `<button class="quiet-button" type="button" data-truth-delete="${round.id}">×</button>`}
    </div>
    <div class="truths-options-list">${items}</div>
  </article>`;
}

async function createTruthRound(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await api('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        action: 'truths_create',
        truth1: data.truth1,
        truth2: data.truth2,
        dream: data.dream,
      }),
    });
    form.reset();
    latestGamesData = result;
    renderTruthsSection(result.truths);
    showToast('Раунд загадан и перемешан 💌');
  } catch (error) {
    showToast(error.message);
  }
}

async function submitTruthGuess(roundId) {
  const radio = document.querySelector(`input[name="truthGuess_${roundId}"]:checked`);
  if (!radio) {
    showToast('Выбери карточку, которая кажется тебе мечтой ✨');
    return;
  }
  try {
    const result = await api('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        action: 'truths_guess',
        round_id: roundId,
        guessed_index: Number(radio.value),
      }),
    });
    latestGamesData = result;
    renderTruthsSection(result.truths);
    showToast('Ответ проверен ✨');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteTruthRound(roundId) {
  try {
    const result = await api('/api/games', {
      method: 'POST',
      body: JSON.stringify({ action: 'truths_delete', round_id: roundId }),
    });
    latestGamesData = result;
    renderTruthsSection(result.truths);
  } catch (error) {
    showToast(error.message);
  }
}

async function resetTruthsHistory() {
  try {
    const result = await api('/api/games', {
      method: 'POST',
      body: JSON.stringify({ action: 'truths_reset' }),
    });
    $('#truthsCreateForm')?.reset();
    latestGamesData = result;
    renderTruthsSection(result.truths);
    showToast('История сброшена.');
  } catch (error) {
    showToast(error.message);
  }
}

/* ================= GAME 2: «ЛЮБИМОЕ СЕЛО» ================= */
// Endless, Google-Dinosaur-style run: one life, a gentle opening pace and a steady ramp.
const RUNNER_FONT = "'Spielarcade', 'Trebuchet MS', ui-rounded, system-ui, sans-serif";
const RUNNER_COW = { key: 'cow', asset: '/assets/runner-cow.svg' };
const RUNNER_COW_RUN = { key: 'cowRun', asset: '/assets/runner-cow-run.svg' };
const RUNNER_START_SPEED = 2.25;
const RUNNER_MAX_SPEED = 12.25;

const RUNNER_OBSTACLES = [
  // Collision boxes describe only the solid painted part of the artwork.
  { key: 'rock', asset: '/assets/runner-rock.svg', label: 'Камень', width: 64, height: 40, baseOffset: 1, hitbox: { x: 8, y: 11, width: 48, height: 29 } },
  // The whole crown is inside the SVG viewport; the compact collision box follows the trunk and low crown.
  { key: 'tree', asset: '/assets/runner-tree.svg', label: 'Дерево', width: 82, height: 112, baseOffset: 5, hitbox: { x: 20, y: 14, width: 42, height: 95 } },
  // Medium obstacle: its horns, tail and transparent margins are deliberately outside the death zone.
  { key: 'bull', asset: '/assets/runner-bull.svg', label: 'Бычок', width: 78, height: 56, baseOffset: 2, hitbox: { x: 13, y: 15, width: 53, height: 34 } },
];

const RUNNER_BONUSES = [
  { key: 'grass', asset: '/assets/runner-grass.svg', label: 'Травка', width: 54, height: 40, points: 60 },
  { key: 'milk', asset: '/assets/runner-milk.svg', label: 'Молоко', width: 34, height: 52, points: 100 },
  { key: 'boots', asset: '/assets/runner-boots.svg', label: 'Ботинки', width: 54, height: 39, points: 80, jumpBoost: true },
];

const runnerImages = {};

function preloadRunnerAssets() {
  if (typeof Image === 'undefined') return;
  [RUNNER_COW, RUNNER_COW_RUN, ...RUNNER_OBSTACLES, ...RUNNER_BONUSES].forEach((item) => {
    if (runnerImages[item.key]) return;
    const image = new Image();
    image.src = item.asset;
    runnerImages[item.key] = image;
  });
}

function createRunnerState() {
  return {
    running: false,
    paused: false,
    rafId: null,
    lives: 1,
    score: 0,
    bonusScore: 0,
    jumpBoostUntil: 0,
    speed: RUNNER_START_SPEED,
    elapsedMs: 0,
    lastFrameAt: 0,
    nextSpawnAt: 3300,
    worldOffset: 0,
    playerY: 0,
    vy: 0,
    jumpsUsed: 0,
    entities: [],
    popups: [],
  };
}

let runnerGame = createRunnerState();
let runnerMyBestScore = 0;
let runnerPartnerBestScore = 0;

function runnerNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function runnerSeconds() {
  return runnerGame.elapsedMs / 1000;
}

function updateRunnerHud() {
  const liveEl = $('#runnerLiveRecord');
  const mineEl = $('#runnerMyRecord');
  const partnerEl = $('#runnerPartnerRecord');
  const badge = $('#runnerRecordBadge');
  // The left pill is deliberately a running number: no clock and no visible wording.
  runnerGame.score = Math.floor(runnerGame.elapsedMs / 88) + runnerGame.bonusScore;
  if (liveEl) liveEl.textContent = String(runnerGame.score);
  if (mineEl) mineEl.textContent = String(runnerMyBestScore);
  if (partnerEl) partnerEl.textContent = String(runnerPartnerBestScore);
  badge?.setAttribute('aria-label', `Мой рекорд ${runnerMyBestScore}; рекорд партнёра ${runnerPartnerBestScore}`);
}

function renderRunnerRecords(runnerData = {}) {
  const mineEl = $('#runnerMyRecord');
  const partnerEl = $('#runnerPartnerRecord');
  const badge = $('#runnerRecordBadge');
  runnerMyBestScore = Number(runnerData?.mine?.best_score || 0);
  runnerPartnerBestScore = Number(runnerData?.partner?.best_score || 0);
  if (mineEl) mineEl.textContent = String(runnerMyBestScore);
  if (partnerEl) partnerEl.textContent = String(runnerPartnerBestScore);
  badge?.setAttribute('aria-label', `Мой рекорд ${runnerMyBestScore}; рекорд партнёра ${runnerPartnerBestScore}`);
}

function runnerJump() {
  if (!runnerGame.running) {
    startRunnerGame();
    return;
  }
  if (runnerGame.jumpsUsed < 2) {
    const boosted = runnerGame.jumpBoostUntil > runnerGame.elapsedMs;
    runnerGame.vy = runnerGame.jumpsUsed === 0 ? (boosted ? -12.1 : -10.6) : (boosted ? -11.3 : -10.1);
    runnerGame.jumpsUsed += 1;
  }
}

function setRunnerOverlay(titleText, buttonText) {
  const overlay = $('#runnerOverlay');
  const title = $('#runnerOverlayTitle');
  const text = $('#runnerOverlayText');
  const btn = $('#runnerStartBtn');
  if (!overlay || !title || !btn) return;
  title.textContent = titleText;
  if (text) text.textContent = '';
  btn.textContent = buttonText;
  overlay.classList.remove('hidden');
}

function startRunnerGame(forceRestart = false) {
  if (runnerGame.paused && !forceRestart) {
    runnerGame.paused = false;
    runnerGame.running = true;
    runnerGame.lastFrameAt = runnerNow();
    $('#runnerOverlay')?.classList.add('hidden');
    runnerGame.rafId = requestAnimationFrame(runnerLoop);
    return;
  }
  cancelAnimationFrame(runnerGame.rafId);
  runnerGame = createRunnerState();
  runnerGame.running = true;
  runnerGame.lastFrameAt = runnerNow();
  $('#runnerOverlay')?.classList.add('hidden');
  updateRunnerHud();
  runnerGame.rafId = requestAnimationFrame(runnerLoop);
}

function restartRunnerGame() {
  startRunnerGame(true);
}

function pauseRunnerGame() {
  if (!runnerGame.running) return;
  runnerGame.running = false;
  runnerGame.paused = true;
  cancelAnimationFrame(runnerGame.rafId);
  setRunnerOverlay('Пауза', 'Продолжить');
}

function drawCowFallback(ctx, x, y, scale = 1, faceLeft = false) {
  ctx.save();
  ctx.translate(x, y);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fffdf5';
  ctx.strokeStyle = '#5f4b3d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-35, -46, 50, 34, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2e2927';
  ctx.fillRect(-16, -34, 12, 9);
  ctx.fillRect(1, -22, 9, 10);
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.roundRect(7, -51, 31, 31, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2e2927';
  ctx.fillRect(17, -41, 3, 4);
  ctx.fillRect(28, -41, 3, 4);
  ctx.strokeStyle = '#5f4b3d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-23, -13); ctx.lineTo(-27, -4);
  ctx.moveTo(0, -13); ctx.lineTo(4, -4);
  ctx.moveTo(18, -13); ctx.lineTo(23, -4);
  ctx.stroke();
  ctx.restore();
}

function drawCowCharacter(ctx, x, y, scale = 1, runningFrame = false) {
  const image = runnerImages[runningFrame ? 'cowRun' : 'cow'];
  const width = 88 * scale;
  const height = 61 * scale;
  ctx.save();
  ctx.translate(x, y);
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, -width / 2, -height - 2, width, height);
  } else {
    drawCowFallback(ctx, 0, 0, scale, false);
  }
  ctx.restore();
}

function drawRunnerStatic() {
  const canvas = $('#runnerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const groundY = H - 38;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  // A still, deliberately blocky landscape: no scrolling grass or shimmering platform.
  ctx.fillStyle = '#8bd5ef';
  ctx.fillRect(0, 0, W, groundY);
  ctx.fillStyle = '#bfeaf6';
  ctx.fillRect(0, groundY - 72, W, 11);
  ctx.fillStyle = '#ffe37d';
  ctx.fillRect(W - 76, 21, 22, 22);
  ctx.fillStyle = '#fff3aa';
  ctx.fillRect(W - 81, 26, 32, 12);

  const cloud = (x, y) => {
    ctx.fillStyle = '#f7fdff';
    ctx.fillRect(x, y + 7, 48, 8);
    ctx.fillRect(x + 9, y + 2, 26, 13);
    ctx.fillRect(x + 17, y - 3, 10, 7);
  };
  cloud(88, 34);
  cloud(326, 53);
  cloud(500, 31);

  const steppedHill = (color, points) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();
  };
  steppedHill('#a9dd85', [
    [0, groundY - 34], [48, groundY - 34], [48, groundY - 47], [104, groundY - 47], [104, groundY - 33],
    [178, groundY - 33], [178, groundY - 56], [246, groundY - 56], [246, groundY - 35], [332, groundY - 35],
    [332, groundY - 49], [408, groundY - 49], [408, groundY - 32], [494, groundY - 32], [494, groundY - 54],
    [562, groundY - 54], [562, groundY - 37], [W, groundY - 37],
  ]);
  steppedHill('#85c96b', [
    [0, groundY - 14], [73, groundY - 14], [73, groundY - 24], [139, groundY - 24], [139, groundY - 12],
    [232, groundY - 12], [232, groundY - 29], [298, groundY - 29], [298, groundY - 15], [390, groundY - 15],
    [390, groundY - 25], [467, groundY - 25], [467, groundY - 12], [W, groundY - 12],
  ]);

  ctx.fillStyle = '#61ac55';
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#347e40';
  ctx.fillRect(0, groundY - 2, W, 3);
  ctx.fillStyle = '#91cf64';
  for (const x of [22, 168, 286, 454, 585]) ctx.fillRect(x, groundY - 7, 8, 5);

  const runFrame = runnerGame.running && runnerGame.playerY === 0 && Math.floor((runnerGame.worldOffset || 0) / 5) % 2 === 1;
  const bob = runnerGame.running && runnerGame.playerY === 0 ? (runFrame ? -1 : 0) : 0;
  drawCowCharacter(ctx, 78, groundY + runnerGame.playerY + bob, 1, runFrame);
}

function entityRect(ent) {
  if (ent.type === 'obstacle') {
    return { x: ent.x - ent.width / 2, y: ent.baseY - ent.height, width: ent.width, height: ent.height };
  }
  return { x: ent.x - ent.width / 2, y: ent.y - ent.height / 2, width: ent.width, height: ent.height };
}

function playerRect(groundY) {
  // A forgiving body-only hitbox: horns, tail and hooves do not cause unfair losses.
  return { x: 55, y: groundY + runnerGame.playerY - 49, width: 45, height: 38 };
}

function entityHitbox(ent, rect = entityRect(ent)) {
  if (ent.type === 'obstacle' && ent.hitbox) {
    const box = ent.hitbox;
    return { x: rect.x + box.x, y: rect.y + box.y, width: box.width, height: box.height };
  }
  // Bonus collection remains generous without becoming wider than the artwork.
  return { x: rect.x + 4, y: rect.y + 4, width: Math.max(1, rect.width - 8), height: Math.max(1, rect.height - 8) };
}

function rectsOverlap(one, two) {
  return one.x < two.x + two.width && one.x + one.width > two.x && one.y < two.y + two.height && one.y + one.height > two.y;
}

function drawRunnerFallback(ctx, ent, rect) {
  ctx.save();
  if (ent.type === 'obstacle') {
    if (ent.key === 'tree') {
      ctx.fillStyle = '#875634';
      ctx.fillRect(rect.x + rect.width * .38, rect.y + rect.height * .38, rect.width * .25, rect.height * .62);
      ctx.fillStyle = '#58a54f';
      ctx.fillRect(rect.x + 4, rect.y, rect.width - 8, rect.height * .48);
    } else if (ent.key === 'bull') {
      ctx.fillStyle = '#bd8050';
      ctx.strokeStyle = '#513a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x + 3, rect.y + 12, rect.width - 6, rect.height - 12, 13);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#a6aeb7';
      ctx.fillRect(rect.x, rect.y + 8, rect.width, rect.height - 8);
    }
  } else {
    ctx.fillStyle = ent.key === 'grass' ? '#65b650' : ent.key === 'milk' ? '#dff6ff' : '#bd7a42';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = '#5b6b54';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  }
  ctx.restore();
}

function drawRunnerEntity(ctx, ent) {
  const rect = entityRect(ent);
  const image = runnerImages[ent.key];
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  } else {
    drawRunnerFallback(ctx, ent, rect);
  }
}

function spawnRunnerEntity(width, groundY) {
  const isBonus = Math.random() < 0.29;
  const collection = isBonus ? RUNNER_BONUSES : RUNNER_OBSTACLES;
  const item = collection[Math.floor(Math.random() * collection.length)];
  if (isBonus) {
    const highBonus = Math.random() < 0.35;
    runnerGame.entities.push({
      type: 'bonus',
      ...item,
      x: width + item.width,
      y: groundY - item.height / 2 - (highBonus ? 72 : 30),
    });
  } else {
    runnerGame.entities.push({
      type: 'obstacle',
      ...item,
      x: width + item.width,
      baseY: groundY + Number(item.baseOffset || 1),
    });
  }
  const nextGap = Math.max(2400, 4550 - runnerSeconds() * 10) + Math.random() * 780;
  runnerGame.nextSpawnAt = runnerGame.elapsedMs + nextGap;
}

function runnerLoop(timestamp) {
  if (!runnerGame.running) return;
  const canvas = $('#runnerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const groundY = canvas.height - 38;
  const now = Number.isFinite(timestamp) ? timestamp : runnerNow();
  const rawDelta = Math.max(0, now - runnerGame.lastFrameAt);
  const delta = Math.min(48, rawDelta || 16.67);
  const step = delta / 16.67;
  runnerGame.lastFrameAt = now;
  runnerGame.elapsedMs += delta;
  // Slow at the start, then continuously faster with no artificial finish line.
  runnerGame.speed = Math.min(RUNNER_MAX_SPEED, RUNNER_START_SPEED + runnerSeconds() * 0.052);
  runnerGame.worldOffset += runnerGame.speed * step;

  runnerGame.playerY += runnerGame.vy * step;
  runnerGame.vy += 0.56 * step;
  if (runnerGame.playerY >= 0) {
    runnerGame.playerY = 0;
    runnerGame.vy = 0;
    runnerGame.jumpsUsed = 0;
  }

  if (runnerGame.entities.length === 0 && runnerGame.elapsedMs >= runnerGame.nextSpawnAt) {
    spawnRunnerEntity(canvas.width, groundY);
  }

  drawRunnerStatic();
  const cowBox = playerRect(groundY);
  for (let i = runnerGame.entities.length - 1; i >= 0; i -= 1) {
    const ent = runnerGame.entities[i];
    ent.x -= runnerGame.speed * step;
    drawRunnerEntity(ctx, ent);
    const rect = entityRect(ent);
    const hitbox = entityHitbox(ent, rect);
    if (rectsOverlap(cowBox, hitbox)) {
      if (ent.type === 'bonus') {
        runnerGame.bonusScore += ent.points;
        if (ent.jumpBoost) runnerGame.jumpBoostUntil = runnerGame.elapsedMs + 5000;
        runnerGame.popups.push({ x: 78, y: cowBox.y - 10, text: ent.jumpBoost ? 'Выше!' : `+${ent.points}`, color: '#397441', ttl: 780 });
      } else {
        runnerGame.lives = 0;
        runnerGame.popups.push({ x: 78, y: cowBox.y - 10, text: 'Столкновение', color: '#87533b', ttl: 780 });
      }
      runnerGame.entities.splice(i, 1);
      continue;
    }
    if (rect.x + rect.width < -20) runnerGame.entities.splice(i, 1);
  }

  for (let i = runnerGame.popups.length - 1; i >= 0; i -= 1) {
    const popup = runnerGame.popups[i];
    popup.y -= 0.055 * delta;
    popup.ttl -= delta;
    ctx.fillStyle = popup.color;
    ctx.font = `12px ${RUNNER_FONT}`;
    ctx.fillText(popup.text, popup.x - 18, popup.y);
    if (popup.ttl <= 0) runnerGame.popups.splice(i, 1);
  }

  updateRunnerHud();
  if (runnerGame.lives <= 0) {
    finishRunnerGame();
    return;
  }
  runnerGame.rafId = requestAnimationFrame(runnerLoop);
}

async function finishRunnerGame() {
  runnerGame.running = false;
  runnerGame.paused = false;
  cancelAnimationFrame(runnerGame.rafId);
  setRunnerOverlay('Забег завершён', 'Ещё раз');
  try {
    const res = await api('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        action: 'runner_score',
        score: runnerGame.score,
      }),
    });
    latestGamesData = res;
    renderRunnerRecords(res.runner);
  } catch {}
}


/* ================= GAME 3: CLASSIC TIC-TAC-TOE ================= */
let tttMode = 'bot';
let localTttState = {
  catMoves: [],
  heartMoves: [],
  turn: 'cat',
  winner: null,
  draw: false,
  winLine: null,
  scores: { cat: 0, heart: 0 },
};

function currentTttData() {
  if (tttMode === 'online' && latestGamesData?.tictactoe) {
    return normalizeClassicTttState(latestGamesData.tictactoe);
  }
  return normalizeClassicTttState(localTttState);
}

function chooseBotCell(state) {
  const occupied = new Set([...state.catMoves, ...state.heartMoves]);
  const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => !occupied.has(cell));
  if (!free.length) return null;

  // First win, then block, then take a simple useful square.
  for (const cell of free) {
    const simulated = applyClassicMove(state, 'heart', cell);
    if (simulated.winner === 'heart') return cell;
  }
  for (const cell of free) {
    const simulated = applyClassicMove({ ...state, turn: 'cat' }, 'cat', cell);
    if (simulated.winner === 'cat') return cell;
  }
  if (free.includes(4)) return 4;
  const corners = [0, 2, 6, 8].filter((cell) => free.includes(cell));
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return free[Math.floor(Math.random() * free.length)];
}

function onlineTttSide() {
  return latestGamesData?.tictactoe?.my_side === 'heart' ? 'heart' : 'cat';
}

function nextTttStateWithScore(previous, next) {
  return {
    ...next,
    scores: {
      cat: Number(previous.scores?.cat || 0) + (next.winner === 'cat' ? 1 : 0),
      heart: Number(previous.scores?.heart || 0) + (next.winner === 'heart' ? 1 : 0),
    },
  };
}

function renderTicTacToe() {
  const state = currentTttData();
  const mySide = tttMode === 'online' ? onlineTttSide() : 'cat';
  const opponentSide = mySide === 'cat' ? 'heart' : 'cat';
  const scores = tttMode === 'online'
    ? (latestGamesData?.tictactoe?.scores || {})
    : (localTttState.scores || {});

  const mineScore = Number(scores[mySide] || 0);
  const opponentScore = Number(scores[opponentSide] || 0);
  const leftScore = $('#tttCatScore');
  const rightScore = $('#tttHeartScore');
  if (leftScore) {
    leftScore.textContent = String(mineScore);
    leftScore.parentElement?.setAttribute('aria-label', `Твои победы: ${mineScore}`);
  }
  if (rightScore) {
    rightScore.textContent = String(opponentScore);
    rightScore.parentElement?.setAttribute('aria-label', `Победы соперника: ${opponentScore}`);
  }

  const banner = $('#tttStatusBanner');
  if (banner) {
    if (state.winner) {
      banner.textContent = state.winner === mySide ? 'Победа!' : 'Победа соперника';
    } else if (state.draw) {
      banner.textContent = 'Ничья';
    } else if (tttMode === 'bot') {
      banner.textContent = state.turn === 'cat' ? 'Твой ход' : 'Ход бота';
    } else if (tttMode === 'online') {
      banner.textContent = state.turn === mySide ? 'Твой ход' : 'Ход соперника';
    } else {
      banner.textContent = state.turn === 'cat' ? 'Ход игрока 1' : 'Ход игрока 2';
    }
  }

  const winSet = new Set(state.winLine || []);
  const onlineWaiting = tttMode === 'online' && !state.winner && !state.draw && state.turn !== mySide;
  $$('#tttBoard .ttt-cell').forEach((cellBtn) => {
    const idx = Number(cellBtn.dataset.tttCell);
    const hasCat = state.catMoves.includes(idx);
    const hasHeart = state.heartMoves.includes(idx);
    cellBtn.innerHTML = hasCat ? CAT_PIECE_SVG : (hasHeart ? HEART_PIECE_SVG : '');
    cellBtn.classList.toggle('is-win', winSet.has(idx));
    cellBtn.classList.toggle('is-draw', Boolean(state.draw));
    cellBtn.disabled = Boolean(state.winner || state.draw || hasCat || hasHeart || (tttMode === 'bot' && state.turn === 'heart') || onlineWaiting);
  });
}

async function handleTttCellClick(cellIndex) {
  const state = currentTttData();
  if (state.winner || state.draw) return;

  if (tttMode === 'online') {
    try {
      const res = await api('/api/games', {
        method: 'POST',
        body: JSON.stringify({ action: 'ttt_move', cell: cellIndex }),
      });
      latestGamesData = res;
      renderTicTacToe();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  try {
    const next = applyClassicMove(localTttState, localTttState.turn, cellIndex);
    localTttState = nextTttStateWithScore(localTttState, next);
    renderTicTacToe();
    if (next.winner || next.draw) return;

    if (tttMode === 'bot' && localTttState.turn === 'heart') {
      setTimeout(() => {
        if (tttMode !== 'bot' || localTttState.turn !== 'heart' || localTttState.winner || localTttState.draw) return;
        const botCell = chooseBotCell(localTttState);
        if (botCell === null) return;
        const afterBot = applyClassicMove(localTttState, 'heart', botCell);
        localTttState = nextTttStateWithScore(localTttState, afterBot);
        renderTicTacToe();
      }, 320);
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function resetTicTacToe() {
  if (tttMode === 'online') {
    try {
      const res = await api('/api/games', { method: 'POST', body: JSON.stringify({ action: 'ttt_reset' }) });
      latestGamesData = res;
      renderTicTacToe();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  localTttState = {
    catMoves: [],
    heartMoves: [],
    turn: 'cat',
    winner: null,
    draw: false,
    winLine: null,
    scores: localTttState.scores,
  };
  renderTicTacToe();
}

async function loadGame(silent = false) {
  try {
    const result = await api('/api/games');
    latestGamesData = result;
    renderTruthsSection(result.truths);
    renderRunnerRecords(result.runner);
    renderTicTacToe();
  } catch (error) {
    if (!silent) showToast(error.message);
  }
}

async function saveProfileName(event) {
  event.preventDefault();
  const name = String(new FormData(event.currentTarget).get('name') || '').trim();
  if (name.length < 2) {
    showToast('Имя должно содержать хотя бы 2 символа.');
    return;
  }
  try {
    await api('/api/pin', { method: 'POST', body: JSON.stringify({ name }) });
    showToast('Имя профиля обновлено ✨');
    await refresh();
  } catch (error) {
    showToast(error.message);
  }
}

function closeTopMenu() {
  const dropdown = $('#topMenuDropdown');
  const trigger = $('#topMenuButton');
  if (dropdown) dropdown.classList.add('hidden');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function toggleTopMenu(event) {
  event.stopPropagation();
  const dropdown = $('#topMenuDropdown');
  const trigger = $('#topMenuButton');
  if (!dropdown || !trigger) return;
  const isHidden = dropdown.classList.toggle('hidden');
  trigger.setAttribute('aria-expanded', String(!isHidden));
}

function switchDateSubtab(view) {
  $$('.date-subtab').forEach((button) => button.classList.toggle('active', button.dataset.dateSubtab === view));
  $('#dateRandomPanel').classList.toggle('hidden', view !== 'random');
  $('#successfulDatesPanel').classList.toggle('hidden', view !== 'successful');
  if (activeView === 'dates') setActiveViewInfo(view === 'successful' ? 'datesHistory' : 'dates');
  if (view === 'successful') loadSuccessfulDates();
}

document.addEventListener('DOMContentLoaded', () => {
  $$('details[data-list-label]').forEach((details) => {
    details.addEventListener('toggle', () => {
      details.querySelector('summary').textContent = `${details.open ? 'Скрыть' : 'Показать'} ${details.dataset.listLabel}`;
    });
  });
  $$('.auth-tab').forEach((button) => button.addEventListener('click', () => { showAuthError(''); showAuth(button.dataset.auth); }));
  $('#createForm').addEventListener('submit', (event) => submitAuth(event, 'create'));
  $('#joinForm').addEventListener('submit', (event) => submitAuth(event, 'join'));
  $('#loginForm').addEventListener('submit', (event) => submitAuth(event, 'login'));
  $$('.main-tab').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('.category-button').forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category;
    $$('.category-button').forEach((item) => item.classList.toggle('selected', item === button));
    renderEncouragement(selectedCategory);
  }));
  $('#noteBody').addEventListener('input', () => { $('#charCount').textContent = `${$('#noteBody').value.length} / 3500`; });
  $('#saveNote').addEventListener('click', saveNote);
  $('#scheduleButton').addEventListener('click', saveSchedule);
  $('#talkNowButton').addEventListener('click', talkNow);
  $('#finishButton').addEventListener('click', finishCycle);
  $$('[data-outcome]').forEach((button) => button.addEventListener('click', () => saveOutcome(button.dataset.outcome)));
  $$('.date-subtab').forEach((button) => button.addEventListener('click', () => switchDateSubtab(button.dataset.dateSubtab)));

  $('#topMenuButton')?.addEventListener('click', toggleTopMenu);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.top-menu')) closeTopMenu();
  });

  $('#feedbackButton').addEventListener('click', async () => { closeTopMenu(); openModal('feedbackModal'); await loadFeedback(); });
  $('#settingsButton').addEventListener('click', () => { closeTopMenu(); openModal('settingsModal'); });
  $('#personalizeButton')?.addEventListener('click', openPersonalization);
  $('#savePersonalizationButton')?.addEventListener('click', savePersonalization);
  $('#partnerBadge')?.addEventListener('click', openPartnerProfile);
  $('#editPartnerProfileButton')?.addEventListener('click', beginPartnerProfileEdit);
  $('#partnerProfileForm')?.addEventListener('submit', savePartnerProfile);
  $('#addPartnerFieldButton')?.addEventListener('click', addPartnerProfileField);
  $$('.game-fullscreen-button').forEach((button) => button.addEventListener('click', () => toggleGameFullscreen(button.dataset.fullscreenTarget)));
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((eventName) => document.addEventListener(eventName, () => {
    if (fullscreenRoot()) $$('.game-fallback-fullscreen').forEach((panel) => setFallbackFullscreen(panel, false));
    updateFullscreenButtons();
  }));
  $('#anniversaryButton').addEventListener('click', async () => {
    renderAnniversary();
    openModal('anniversaryModal');
    await loadAnniversaryIdeas();
  });
  $$('.mailbox-subtab').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.mailboxView)));
  $$('[data-info-key]').forEach((button) => button.addEventListener('click', () => openInfoModal(button.dataset.infoKey)));
  setActiveViewInfo('mailbox');

  // Games subtabs & events
  $$('.game-subtab').forEach((button) => button.addEventListener('click', () => switchGameSubtab(button.dataset.gameSubtab)));
  $('#truthTopicBtn')?.addEventListener('click', showNextTruthTopicHint);
  $('#truthsCreateForm')?.addEventListener('submit', createTruthRound);
  $('#truthsResetBtn')?.addEventListener('click', resetTruthsHistory);

  $('#runnerStartBtn')?.addEventListener('click', (e) => { e.stopPropagation(); startRunnerGame(); });
  $('#runnerRestartBtn')?.addEventListener('click', () => restartRunnerGame());
  $('#runnerStage')?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#runnerStartBtn')) return;
    runnerJump();
  });
  document.addEventListener('keydown', (event) => {
    if (activeView === 'games' && activeGameSubtab === 'runner' && (event.code === 'Space' || event.code === 'ArrowUp')) {
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      event.preventDefault();
      runnerJump();
    }
  });

  $$('.ttt-mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    tttMode = btn.dataset.tttMode || 'bot';
    $$('.ttt-mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderTicTacToe();
  }));
  $$('#tttBoard .ttt-cell').forEach((cell) => cell.addEventListener('click', () => handleTttCellClick(Number(cell.dataset.tttCell))));
  $('#tttResetBtn')?.addEventListener('click', resetTicTacToe);

  renderAnniversary();
  setInterval(renderAnniversary, 1000);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('.overlay-modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal.id); }));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const fallbackPanel = $('.game-fallback-fullscreen');
    if (fallbackPanel) {
      setFallbackFullscreen(fallbackPanel, false);
      event.preventDefault();
      return;
    }
    closeTopMenu();
    $$('.overlay-modal:not(.hidden)').forEach((modal) => closeModal(modal.id));
  });
  $('#feedbackForm').addEventListener('submit', saveFeedback);
  $('#anniversaryIdeaForm').addEventListener('submit', saveAnniversaryIdea);
  $('#logoutButton').addEventListener('click', async () => {
    closeTopMenu();
    await api('/api/logout', { method: 'POST', body: '{}' });
    appState = null;
    localStorage.setItem('quiet_mailbox_auth', 'login');
    showAuth('login');
  });
  $('#notificationButton').addEventListener('click', requestNotifications);
  $('#profileNameForm')?.addEventListener('submit', saveProfileName);
  $('#pinForm').addEventListener('submit', savePin);
  $('#nudgeToggle').addEventListener('change', async (event) => {
    try { await api('/api/nudges', { method: 'POST', body: JSON.stringify({ enabled: event.target.checked }) }); showToast('Настройка сохранена.'); }
    catch (error) { showToast(error.message); }
  });
  $('#copyCode').addEventListener('click', () => copyText(appState?.pair_code || ''));
  $('#copyBannerCode').addEventListener('click', () => copyText(appState?.pair_code || ''));
  const updateDateChoice = () => {
    $$('[data-date-kind]').forEach((item) => item.classList.toggle('active', item.dataset.dateKind === selectedDateKind));
    $$('[data-date-place]').forEach((item) => item.classList.toggle('active', item.dataset.datePlace === selectedDatePlace));
    if (selectedDateKind && selectedDatePlace) {
      $('#dateIdeaHint').textContent = 'Подбираю идею…';
      drawIdea(selectedDateKind, 'dateIdeaResult', selectedDatePlace);
    } else {
      $('#dateIdeaResult').classList.add('hidden');
      $('#dateIdeaHint').textContent = selectedDateKind ? 'Теперь выберите место.' : selectedDatePlace ? 'Теперь выберите настроение.' : 'Выберите настроение и место.';
    }
  };
  $$('[data-date-kind]').forEach((button) => button.addEventListener('click', () => {
    selectedDateKind = button.dataset.dateKind;
    updateDateChoice();
  }));
  $$('[data-date-place]').forEach((button) => button.addEventListener('click', () => {
    selectedDatePlace = button.dataset.datePlace;
    updateDateChoice();
  }));
  $('#dateIdeaForm').addEventListener('submit', (event) => addIdea(event));
  $('#dateIdeasManage').addEventListener('toggle', (event) => { if (event.target.open) loadIdeaLists('date'); });
  $('#openCapsuleButton').addEventListener('click', openCapsule);
  $('#capsuleForm').addEventListener('submit', (event) => addOurItem(event, '/api/capsule'));
  $('#agreementForm').addEventListener('submit', (event) => addOurItem(event, '/api/agreements'));
  $('#decisionForm').addEventListener('submit', (event) => addOurItem(event, '/api/decisions'));
  $('#wishForm').addEventListener('submit', addWish);
  $('#intimateWishForm').addEventListener('submit', addWish);
  $('#decisionKind').addEventListener('change', () => {
    $('#decisionResult').classList.add('hidden');
    $('#chooseDecisionButton').textContent = 'Выбрать ответ 🎲';
  });
  $('#chooseDecisionButton').addEventListener('click', chooseDecision);
  renderDecisionSelectors();
  preloadRunnerAssets();
  drawRunnerStatic();
  // Canvas text can render before a webfont is ready; redraw once Spielarcade has loaded.
  document.fonts?.ready?.then(() => { if (!runnerGame.running) drawRunnerStatic(); }).catch(() => {});
  renderTicTacToe();
  refresh();
  setInterval(refresh, 20000);
});
