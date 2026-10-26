export const THEME_KEYS = ['white', 'pink', 'purple', 'blue', 'yellow', 'cyan'];

export const TAB_ORDER_DEFAULTS = {
  main: ['mailbox', 'dates', 'our', 'games'],
  mailbox: ['mailbox', 'conversation', 'homework', 'capsule'],
  games: ['truths', 'runner', 'tictactoe'],
  dates: ['random', 'successful'],
};

function objectValue(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeOrder(value, fallback) {
  const supplied = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const allowed = new Set(fallback);
  const unique = [];
  supplied.forEach((item) => {
    if (allowed.has(item) && !unique.includes(item)) unique.push(item);
  });
  fallback.forEach((item) => {
    if (!unique.includes(item)) unique.push(item);
  });
  return unique;
}

export function normalizePreferences(value) {
  const raw = objectValue(value);
  return {
    theme: THEME_KEYS.includes(raw.theme) ? raw.theme : 'pink',
    orders: {
      main: normalizeOrder(raw.orders?.main, TAB_ORDER_DEFAULTS.main),
      mailbox: normalizeOrder(raw.orders?.mailbox, TAB_ORDER_DEFAULTS.mailbox),
      games: normalizeOrder(raw.orders?.games, TAB_ORDER_DEFAULTS.games),
      dates: normalizeOrder(raw.orders?.dates, TAB_ORDER_DEFAULTS.dates),
    },
  };
}

export function mergePreferences(current, update) {
  const base = normalizePreferences(current);
  const raw = objectValue(update);
  const theme = raw.theme === undefined
    ? base.theme
    : (THEME_KEYS.includes(raw.theme) ? raw.theme : base.theme);
  const requestedOrders = objectValue(raw.orders);
  return {
    theme,
    orders: {
      main: requestedOrders.main === undefined ? base.orders.main : normalizeOrder(requestedOrders.main, TAB_ORDER_DEFAULTS.main),
      mailbox: requestedOrders.mailbox === undefined ? base.orders.mailbox : normalizeOrder(requestedOrders.mailbox, TAB_ORDER_DEFAULTS.mailbox),
      games: requestedOrders.games === undefined ? base.orders.games : normalizeOrder(requestedOrders.games, TAB_ORDER_DEFAULTS.games),
      dates: requestedOrders.dates === undefined ? base.orders.dates : normalizeOrder(requestedOrders.dates, TAB_ORDER_DEFAULTS.dates),
    },
  };
}
