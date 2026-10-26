import create from '../endpoints/create.js';
import join from '../endpoints/join.js';
import login from '../endpoints/login.js';
import state from '../endpoints/state.js';
import notes from '../endpoints/notes.js';
import schedule from '../endpoints/schedule.js';
import open from '../endpoints/open.js';
import finish from '../endpoints/finish.js';
import nudges from '../endpoints/nudges.js';
import logout from '../endpoints/logout.js';
import pin from '../endpoints/pin.js';
import ideas from '../endpoints/ideas.js';
import outcome from '../endpoints/outcome.js';
import dateHistory from '../endpoints/date-history.js';
import homework from '../endpoints/homework.js';
import capsule from '../endpoints/capsule.js';
import agreements from '../endpoints/agreements.js';
import decisions from '../endpoints/decisions.js';
import wins from '../endpoints/wins.js';
import feedback from '../endpoints/feedback.js';
import games from '../endpoints/games.js';
import wishes from '../endpoints/wishes.js';
import anniversaryIdeas from '../endpoints/anniversary-ideas.js';
import preferences from '../endpoints/preferences.js';
import partnerProfile from '../endpoints/partner-profile.js';

const routes = {
  create,
  join,
  login,
  state,
  notes,
  schedule,
  open,
  finish,
  nudges,
  logout,
  pin,
  ideas,
  outcome,
  'date-history': dateHistory,
  homework,
  capsule,
  agreements,
  decisions,
  wins,
  feedback,
  games,
  wishes,
  'anniversary-ideas': anniversaryIdeas,
  preferences,
  'partner-profile': partnerProfile,
};

function routeName(req) {
  const param = req.query?.path;
  if (Array.isArray(param) && param.length) return param[param.length - 1];
  if (typeof param === 'string' && param) return param.split('/').filter(Boolean).pop();
  const pathname = new URL(req.url || '/', 'https://quiet-mailbox.local').pathname;
  return pathname.split('/').filter(Boolean).pop();
}

export default async function handler(req, res) {
  const name = routeName(req);
  const endpoint = routes[name];
  if (!endpoint) return res.status(404).json({ ok: false, error: 'Неизвестный API-маршрут.' });
  return endpoint(req, res);
}
