export const THEME_KEYS = ['pink', 'purple', 'blue'];
export const HOME_BLOCKS = ['decisions', 'agreements', 'wishes', 'intimate'];
export const TAB_ORDER_DEFAULTS = {
  main: ['our', 'mailbox', 'dates', 'games'],
  mailbox: ['mailbox', 'conversation', 'homework', 'agreements', 'capsule'],
  games: ['truths', 'runner', 'tictactoe'],
  dates: ['random', 'successful'],
};
function objectValue(value) {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function normalizeOrder(value, fallback) {
  const unique = [];
  for (const item of Array.isArray(value) ? value : []) if (fallback.includes(String(item)) && !unique.includes(String(item))) unique.push(String(item));
  return [...unique, ...fallback.filter(item => !unique.includes(item))];
}
// «Наш уголок» — вход в приложение, поэтому он всегда первый, даже если
// в сохранённых настройках вкладки когда-то были расставлены иначе.
export const PINNED_FIRST = { main: 'our' };
export function pinFirst(list, key) {
  return [key, ...list.filter(item => item !== key)];
}
export function normalizePreferences(value) {
  const raw = objectValue(value);
  const theme = THEME_KEYS.includes(raw.theme) ? raw.theme : raw.theme === 'cyan' ? 'blue' : 'pink';
  const homeTitles = {};
  for (const key of HOME_BLOCKS) if (typeof raw.homeTitles?.[key] === 'string' && raw.homeTitles[key].trim()) homeTitles[key] = raw.homeTitles[key].trim().slice(0, 60);
  return {
    appearanceVersion: 34,
    theme,
    mode: ['light', 'dark', 'system'].includes(raw.mode) ? raw.mode : 'light',
    homeOrder: normalizeOrder(raw.homeOrder, HOME_BLOCKS),
    homeHidden: [...new Set((Array.isArray(raw.homeHidden) ? raw.homeHidden : []).filter(key => HOME_BLOCKS.includes(key)))],
    homeTitles,
    orders: {
      main: pinFirst(normalizeOrder(raw.orders?.main, TAB_ORDER_DEFAULTS.main), PINNED_FIRST.main),
      mailbox: normalizeOrder(raw.orders?.mailbox, TAB_ORDER_DEFAULTS.mailbox),
      games: normalizeOrder(raw.orders?.games, TAB_ORDER_DEFAULTS.games),
      dates: normalizeOrder(raw.orders?.dates, TAB_ORDER_DEFAULTS.dates),
    },
  };
}
export function mergePreferences(current, update) {
  const base = normalizePreferences(current), raw = objectValue(update);
  return normalizePreferences({ ...base, ...raw,
    theme: raw.theme === undefined || !THEME_KEYS.includes(raw.theme) ? base.theme : raw.theme,
    orders: {...base.orders, ...objectValue(raw.orders)},
  });
}
