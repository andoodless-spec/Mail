/* Резервная копия «Тихого ящика».
   Экспорт собирает данные через уже существующие GET-маршруты, импорт — через
   существующие POST-маршруты. Новых API и таблиц не требуется, формат хранения
   на сервере не меняется. Восстановление всегда идёт в режиме «добавить
   недостающее»: ничего не удаляется и не перезаписывается молча. */
(() => {
  const BACKUP_FORMAT = 'quiet-mailbox-backup';
  const BACKUP_VERSION = 1;

  const SECTION_LABELS = {
    notes: 'Письма',
    wishes_general: 'Желания',
    wishes_intimate: 'Личные желания',
    agreements: 'Договорённости',
    capsule: 'Капсула тепла',
    decisions: 'Свои варианты решений',
    feedback: 'Идеи по сайту',
    date_history: 'История свиданий',
    date_ideas: 'Свои идеи свиданий',
    anniversary_ideas: 'Идеи на годовщину',
    homework: 'Домашние задания',
    partner_profile: 'Карточка партнёра',
    games: 'Игры',
    preferences: 'Оформление',
  };

  const RESTORE_PATHS = {
    agreements: '/api/agreements',
    capsule: '/api/capsule',
    decisions: '/api/decisions',
    feedback: '/api/feedback',
    date_history: '/api/date-history',
    date_ideas: '/api/ideas',
    anniversary_ideas: '/api/anniversary-ideas',
    wishes_general: '/api/wishes?kind=general',
    wishes_intimate: '/api/wishes?kind=intimate',
  };

  // Локальная модель и сервер называют текст по-разному (`text`, `body`, `idea`),
  // поэтому копия читает любое из этих полей — иначе часть записей ушла бы пустой.
  function pickText(entry) {
    if (!entry || typeof entry !== 'object') return '';
    return String(entry.text ?? entry.body ?? entry.idea ?? '');
  }

  function textKey(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  async function safeGet(path) {
    try {
      return await api(path);
    } catch (error) {
      return { ok: false, error: error.message || 'Не удалось прочитать данные.' };
    }
  }

  function listOf(payload, key) {
    if (!payload || payload.ok === false) return [];
    const value = key ? payload[key] : payload;
    return Array.isArray(value) ? value : [];
  }

  async function collectBackup() {
    const state = await api('/api/state');
    const [wishesGeneral, wishesIntimate, agreements, capsule, decisions, feedback, dateHistory, anniversary, homework, games, partnerProfile] = await Promise.all([
      safeGet('/api/wishes?kind=general'),
      safeGet('/api/wishes?kind=intimate'),
      safeGet('/api/agreements'),
      safeGet('/api/capsule'),
      safeGet('/api/decisions'),
      safeGet('/api/feedback'),
      safeGet('/api/date-history'),
      safeGet('/api/anniversary-ideas'),
      safeGet('/api/homework'),
      safeGet('/api/games'),
      safeGet('/api/partner-profile'),
    ]);
    const ideaCombos = [['budget', 'inside'], ['budget', 'outside'], ['treat', 'inside'], ['treat', 'outside']];
    const ideaLists = await Promise.all(ideaCombos.map(([kind, place]) => safeGet(`/api/ideas?kind=${kind}&place=${place}&list=1`)));
    const dateIdeas = ideaLists.flatMap((payload, index) => listOf(payload, 'ideas').map((idea) => ({
      kind: ideaCombos[index][0],
      place: ideaCombos[index][1],
      text: pickText(idea),
      mine: Boolean(idea.mine),
    })));

    const sections = {
      notes: listOf(state, 'notes').map((note) => ({ id: note.id ?? null, category: note.category, body: note.body, author: note.author || '', created_at: note.created_at || null })),
      wishes_general: listOf(wishesGeneral, 'mine').map((wish) => ({ text: pickText(wish), is_hidden: Boolean(wish.is_hidden), received: Boolean(wish.received) })),
      wishes_intimate: listOf(wishesIntimate, 'mine').map((wish) => ({ text: pickText(wish), is_hidden: Boolean(wish.is_hidden), received: Boolean(wish.received) })),
      agreements: listOf(agreements, 'agreements').map((item) => ({ text: pickText(item), status: item.status })),
      capsule: listOf(capsule, 'entries').map((item) => ({ text: pickText(item), created_at: item.created_at || null })),
      decisions: listOf(decisions, 'options').filter((item) => !item.builtin).map((item) => ({ kind: item.kind, text: pickText(item) })),
      feedback: listOf(feedback, 'ideas').map((item) => ({ text: pickText(item), mine: Boolean(item.mine) })),
      date_history: listOf(dateHistory, 'dates').map((item) => ({ kind: item.kind, place: item.place, idea: pickText(item), reflection: item.reflection || '', repeat: item.repeat })),
      date_ideas: dateIdeas,
      anniversary_ideas: listOf(anniversary, 'ideas').map((item) => ({ text: pickText(item), mine: Boolean(item.mine) })),
      // Чужой ответ партнёра в копию не попадает: он не наш, и восстанавливать его нельзя.
      homework: listOf(homework, 'cases').map((item) => ({
        problem: item.problem || '',
        my_answer: item.my_answer ? { body: pickText(item.my_answer) } : null,
        created_at: item.created_at || null,
      })),
      partner_profile: partnerProfile && partnerProfile.ok !== false ? { fields: partnerProfile.fields || null } : null,
      games: games && games.ok !== false ? {
        // Только свои раунды, где известен спрятанный ответ, и свой рекорд.
        truths_rounds: listOf(games.truths, 'rounds')
          .filter((round) => round.is_author && Number.isInteger(Number(round.dream_index)) && Array.isArray(round.options))
          .map((round) => ({ options: round.options.slice(0, 3), dream_index: Number(round.dream_index) })),
        runner_best: games.runner?.mine?.best_score ?? null,
        tictactoe_scores: games.tictactoe?.scores || null,
      } : null,
      preferences: normalizeClientPreferences(state.preferences),
    };

    return {
      format: BACKUP_FORMAT,
      format_version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      app: { name: 'Тихий ящик', version: '2.1.0' },
      storage: document.documentElement.dataset.storage === 'cloud' ? 'cloud' : 'local',
      profile: {
        user: state.user ? { name: state.user.name } : null,
        partner: state.partner ? { name: state.partner.name } : null,
        timezone: state.timezone || null,
        letters_opened: Boolean(state.opened),
      },
      sections,
      counts: Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0])),
    };
  }

  function validateBackup(raw) {
    const errors = [];
    const warnings = [];
    let data = raw;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch { return { ok: false, errors: ['Файл не похож на JSON: не удалось его прочитать.'], warnings: [], counts: {}, backup: null }; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['В файле нет данных резервной копии.'], warnings: [], counts: {}, backup: null };
    if (data.format !== BACKUP_FORMAT) errors.push('Это не резервная копия «Тихого ящика»: не совпадает опознавательный признак файла.');
    const version = Number(data.format_version);
    if (!Number.isFinite(version)) errors.push('В файле не указана версия формата.');
    else if (version > BACKUP_VERSION) warnings.push(`Копия сделана более новой версией (формат ${version}, поддерживается ${BACKUP_VERSION}). Разделы, которых нет в этой версии, будут пропущены.`);
    if (!data.sections || typeof data.sections !== 'object' || Array.isArray(data.sections)) errors.push('В копии нет раздела с записями.');

    const sections = data.sections && typeof data.sections === 'object' ? data.sections : {};
    const counts = {};
    for (const [key, value] of Object.entries(sections)) {
      if (!SECTION_LABELS[key]) continue;
      counts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
    }
    if (!Object.keys(counts).length) errors.push('В копии нет ни одной знакомой записи.');
    if (data.profile && data.profile.letters_opened === false) warnings.push('На момент копии письма были закрыты, поэтому текстов писем в файле нет. Остальные разделы сохранены.');
    if (counts.notes) warnings.push('Письма сохраняются в копию, но автоматически не восстанавливаются: они принадлежат конкретному циклу разговора.');
    if (counts.homework) warnings.push('Домашние задания: вернутся только ответы в те задания, которые ещё открыты. Закрытое задание вернуть нельзя — запись, из которой оно создано, удаляется при его создании.');
    if (counts.games) warnings.push('Из игр восстанавливаются только твои раунды «Две правды и мечта» и личный рекорд забега. Счёт крестиков-ноликов заново не выставляется: он зарабатывается партиями.');
    if (data.storage === 'local') warnings.push('Копия сделана в локальном режиме: эти записи не синхронизировались с облаком.');
    return { ok: errors.length === 0, errors, warnings, counts, backup: data };
  }

  async function currentIndex() {
    const index = {};
    const state = await safeGet('/api/state');
    index.notes = new Set(listOf(state, 'notes').map((note) => textKey(pickText(note))));
    const [wishesGeneral, wishesIntimate, agreements, capsule, decisions, feedback, dateHistory, anniversary] = await Promise.all([
      safeGet('/api/wishes?kind=general'), safeGet('/api/wishes?kind=intimate'), safeGet('/api/agreements'),
      safeGet('/api/capsule'), safeGet('/api/decisions'), safeGet('/api/feedback'), safeGet('/api/date-history'), safeGet('/api/anniversary-ideas'),
    ]);
    const ideaCombos = [['budget', 'inside'], ['budget', 'outside'], ['treat', 'inside'], ['treat', 'outside']];
    const ideaLists = await Promise.all(ideaCombos.map(([kind, place]) => safeGet(`/api/ideas?kind=${kind}&place=${place}&list=1`)));
    index.wishes_general = new Set(listOf(wishesGeneral, 'mine').map((wish) => textKey(pickText(wish))));
    index.wishes_intimate = new Set(listOf(wishesIntimate, 'mine').map((wish) => textKey(pickText(wish))));
    index.agreements = new Set(listOf(agreements, 'agreements').map((item) => textKey(pickText(item))));
    index.capsule = new Set(listOf(capsule, 'entries').map((item) => textKey(pickText(item))));
    index.decisions = new Set(listOf(decisions, 'options').filter((item) => !item.builtin).map((item) => `${item.kind}::${textKey(pickText(item))}`));
    index.feedback = new Set(listOf(feedback, 'ideas').map((item) => textKey(pickText(item))));
    index.date_history = new Set(listOf(dateHistory, 'dates').map((item) => textKey(pickText(item))));
    index.date_ideas = new Set(ideaLists.flatMap((payload) => listOf(payload, 'ideas')).map((idea) => textKey(pickText(idea))));
    index.anniversary_ideas = new Set(listOf(anniversary, 'ideas').map((item) => textKey(pickText(item))));
    return index;
  }

  function entryKey(section, entry) {
    if (section === 'decisions') return `${entry.kind}::${textKey(pickText(entry))}`;
    return textKey(pickText(entry));
  }

  async function pushEntry(section, entry) {
    if (section === 'wishes_general' || section === 'wishes_intimate') {
      return api(RESTORE_PATHS[section], { method: 'POST', body: JSON.stringify({ kind: section === 'wishes_intimate' ? 'intimate' : 'general', text: entry.text }) });
    }
    if (section === 'agreements') return api('/api/agreements', { method: 'POST', body: JSON.stringify({ text: entry.text }) });
    if (section === 'capsule') return api('/api/capsule', { method: 'POST', body: JSON.stringify({ body: entry.text }) });
    if (section === 'decisions') return api('/api/decisions', { method: 'POST', body: JSON.stringify({ kind: entry.kind, text: entry.text }) });
    if (section === 'feedback') return api('/api/feedback', { method: 'POST', body: JSON.stringify({ text: entry.text }) });
    if (section === 'date_history') return api('/api/date-history', { method: 'POST', body: JSON.stringify({ kind: entry.kind, place: entry.place, idea: entry.idea, status: entry.status || 'completed', reflection: entry.reflection || '' }) });
    if (section === 'date_ideas') return api('/api/ideas', { method: 'POST', body: JSON.stringify({ kind: entry.kind, place: entry.place, text: entry.text }) });
    if (section === 'anniversary_ideas') return api('/api/anniversary-ideas', { method: 'POST', body: JSON.stringify({ text: entry.text }) });
    throw new Error('Этот раздел пока не восстанавливается.');
  }


  function roundKey(options) {
    return (options || []).map(textKey).sort().join('|');
  }

  // Домашнее задание создаётся сервером из записи-гадости, и запись при этом
  // удаляется. Значит, вернуть закрытое задание нельзя — пришлось бы выдумать
  // запись. Поэтому восстанавливаем только ответы в те задания, которые ещё есть.
  async function restoreHomework(backup, report) {
    const cases = Array.isArray(backup.sections?.homework) ? backup.sections.homework : [];
    if (!cases.length) return;
    report.added.homework = 0;
    report.skipped.homework = 0;
    const current = await safeGet('/api/homework');
    const currentCases = listOf(current, 'cases');
    let lost = 0;
    for (const item of cases) {
      const problem = textKey(item.problem);
      if (!problem) { report.skipped.homework += 1; continue; }
      const existing = currentCases.find((entry) => textKey(entry.problem) === problem);
      if (!existing) { lost += 1; report.skipped.homework += 1; continue; }
      if (existing.my_answer) { report.skipped.homework += 1; continue; }
      const answer = item.my_answer ? pickText(item.my_answer) : '';
      if (!answer) { report.skipped.homework += 1; continue; }
      try {
        await api('/api/homework', { method: 'POST', body: JSON.stringify({ action: 'answer', case_id: existing.id, body: answer }) });
        report.added.homework += 1;
      } catch (error) {
        report.failed.push({ section: 'homework', text: item.problem, error: error.message || 'Не удалось сохранить ответ.' });
      }
    }
    if (lost) {
      if (!report.notes) report.notes = [];
      report.notes.push(`Домашних заданий без исходной записи: ${lost}. Их нельзя вернуть — основа удаляется при создании задания, а придумывать запись заново неправильно.`);
    }
  }

  async function restoreGames(backup, report) {
    const games = backup.sections?.games;
    if (!games || typeof games !== 'object') return;
    const current = await safeGet('/api/games');
    const rounds = Array.isArray(games.truths_rounds) ? games.truths_rounds : [];
    if (rounds.length) {
      report.added.games = 0;
      report.skipped.games = 0;
      const existing = new Set(listOf(current.truths, 'rounds').filter((round) => round.is_author).map((round) => roundKey(round.options)));
      for (const round of rounds) {
        const options = Array.isArray(round.options) ? round.options.map((text) => String(text)) : [];
        const dreamIndex = Number(round.dream_index);
        if (options.length !== 3 || !Number.isInteger(dreamIndex) || dreamIndex < 0 || dreamIndex > 2) { report.skipped.games += 1; continue; }
        const key = roundKey(options);
        if (existing.has(key)) { report.skipped.games += 1; continue; }
        const truths = options.filter((_, index) => index !== dreamIndex);
        try {
          await api('/api/games', { method: 'POST', body: JSON.stringify({ action: 'truths_create', truth1: truths[0], truth2: truths[1], dream: options[dreamIndex] }) });
          existing.add(key);
          report.added.games += 1;
        } catch (error) {
          report.failed.push({ section: 'games', text: options.join(' / '), error: error.message || 'Не удалось вернуть раунд.' });
        }
      }
    }
    const best = Number(games.runner_best);
    if (Number.isFinite(best) && best > 0) {
      const mine = Number(current.runner?.mine?.best_score || 0);
      if (best <= mine) {
        report.skipped.games = Number(report.skipped.games || 0) + 1;
      } else {
        try {
          await api('/api/games', { method: 'POST', body: JSON.stringify({ action: 'runner_score', score: best }) });
          report.added.games = Number(report.added.games || 0) + 1;
        } catch (error) {
          report.failed.push({ section: 'games', text: 'Рекорд забега', error: error.message || 'Не удалось вернуть рекорд.' });
        }
      }
    }
    if (games.tictactoe_scores) {
      if (!report.notes) report.notes = [];
      report.notes.push('Счёт крестиков-ноликов не восстанавливается: он зарабатывается партиями, а не настройкой.');
    }
  }

  // Ничего не удаляет: добавляет только те записи, которых сейчас нет.
  async function applyBackup(backup, options = {}) {
    const report = { added: {}, skipped: {}, failed: [] };
    const index = await currentIndex();
    const sections = backup.sections || {};
    for (const [section, path] of Object.entries(RESTORE_PATHS)) {
      const entries = Array.isArray(sections[section]) ? sections[section] : [];
      if (!entries.length) continue;
      if (!index[section]) index[section] = new Set();
      report.added[section] = 0;
      report.skipped[section] = 0;
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (!pickText(entry).trim() && section !== 'date_history') continue;
        const key = entryKey(section, entry);
        if (!key) { report.skipped[section] += 1; continue; }
        if (index[section].has(key)) { report.skipped[section] += 1; continue; }
        try {
          await pushEntry(section, entry);
          index[section].add(key);
          report.added[section] += 1;
        } catch (error) {
          report.failed.push({ section, text: pickText(entry), error: error.message || 'Не удалось сохранить.' });
        }
        if (typeof options.onProgress === 'function') options.onProgress({ section, report });
      }
    }

    await restoreHomework(backup, report);
    await restoreGames(backup, report);

    const profile = sections.partner_profile;
    if (profile && Array.isArray(profile.fields) && profile.fields.length) {
      try {
        await api('/api/partner-profile', { method: 'POST', body: JSON.stringify({ fields: profile.fields }) });
        report.partnerProfile = 'restored';
      } catch (error) {
        report.partnerProfile = 'failed';
        report.failed.push({ section: 'partner_profile', text: 'Карточка партнёра', error: error.message });
      }
    }

    const preferences = sections.preferences;
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences) && options.restorePreferences !== false) {
      try {
        const result = await api('/api/preferences', { method: 'POST', body: JSON.stringify(normalizeClientPreferences(preferences)) });
        const saved = normalizeClientPreferences(result.preferences);
        // Состояние может быть ещё не загружено (например, при раннем вызове) —
        // тогда просто применяем оформление, не падая.
        if (typeof appState !== 'undefined' && appState) appState.preferences = saved;
        if (typeof applyPersonalization === 'function') applyPersonalization(saved);
        report.preferences = 'restored';
      } catch (error) {
        report.preferences = 'failed';
        report.failed.push({ section: 'preferences', text: 'Оформление', error: error.message });
      }
    }
    return report;
  }

  function reportText(report) {
    const parts = [];
    const added = Object.entries(report.added || {}).filter(([, count]) => count > 0);
    const skipped = Object.entries(report.skipped || {}).filter(([, count]) => count > 0);
    if (added.length) parts.push('Добавлено: ' + added.map(([key, count]) => `${SECTION_LABELS[key]} — ${count}`).join(', ') + '.');
    if (skipped.length) parts.push('Уже было, пропущено: ' + skipped.map(([key, count]) => `${SECTION_LABELS[key]} — ${count}`).join(', ') + '.');
    if (report.partnerProfile === 'restored') parts.push('Карточка партнёра восстановлена.');
    if (report.preferences === 'restored') parts.push('Оформление восстановлено.');
    if (report.notes && report.notes.length) parts.push(report.notes.join(' '));
    if (report.failed && report.failed.length) {
      const first = report.failed[0];
      parts.push(`Не удалось восстановить ${report.failed.length} записей. Первая ошибка: «${first.text}» — ${first.error}`);
    }
    return parts.length ? parts.join(' ') : 'Новых записей в копии не нашлось.';
  }

  function downloadBackup(backup) {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tihiy-yashchik-backup-${stamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function previewMarkup(check) {
    const rows = Object.entries(check.counts).filter(([, count]) => count > 0)
      .map(([key, count]) => `<li><span>${SECTION_LABELS[key]}</span><strong>${count}</strong></li>`).join('');
    const warnings = check.warnings.map((text) => `<li>${escapeHtml(text)}</li>`).join('');
    return `
      <div class="backup-summary">
        <p class="backup-file-note">Проверка файла прошла. Сейчас в нём: ${Object.values(check.counts).reduce((sum, count) => sum + count, 0)} записей.</p>
        <ul class="backup-count-list">${rows}</ul>
        ${warnings ? `<div class="backup-warning" role="note"><strong>Что важно знать</strong><ul>${warnings}</ul></div>` : ''}
        <p class="small-note">Восстановление только добавляет недостающее. Существующие записи не удаляются и не заменяются.</p>
        <div class="backup-actions">
          <button id="confirmImportBackup" class="button primary" type="button">Добавить к текущим</button>
          <button id="cancelImportBackup" class="button secondary" type="button">Отмена</button>
        </div>
      </div>`;
  }

  function initBackup() {
    const exportButton = $('#exportBackupButton');
    const importButton = $('#importBackupButton');
    const input = $('#importBackupInput');
    const preview = $('#importBackupPreview');
    const status = $('#backupStatus');
    if (!exportButton || !importButton || !input || !preview) return;
    let pending = null;

    const setStatus = (text) => { if (status) status.textContent = text; };
    const resetPreview = () => { preview.innerHTML = ''; preview.classList.add('hidden'); pending = null; };

    exportButton.addEventListener('click', async () => {
      exportButton.disabled = true;
      setStatus('Собираю копию…');
      try {
        const backup = await collectBackup();
        downloadBackup(backup);
        const total = Object.values(backup.counts).reduce((sum, count) => sum + count, 0);
        const closed = backup.profile.letters_opened ? '' : ' Письма были закрыты, поэтому их текстов нет в файле.';
        setStatus(`Копия скачана: ${total} записей.${closed}`);
        showToast('Резервная копия скачана.');
      } catch (error) {
        setStatus('');
        showToast(error.message || 'Не удалось собрать копию.');
      } finally {
        exportButton.disabled = false;
      }
    });

    importButton.addEventListener('click', () => { input.value = ''; input.click(); });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setStatus('Проверяю файл…');
      resetPreview();
      try {
        const text = await file.text();
        const check = validateBackup(text);
        if (!check.ok) {
          setStatus('');
          preview.innerHTML = `<div class="backup-warning" role="alert"><strong>Файл не подошёл</strong><ul>${check.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul><p class="small-note">Текущие записи не изменены.</p></div>`;
          preview.classList.remove('hidden');
          return;
        }
        pending = check.backup;
        setStatus('');
        preview.innerHTML = previewMarkup(check);
        preview.classList.remove('hidden');
        $('#confirmImportBackup')?.addEventListener('click', confirmImport);
        $('#cancelImportBackup')?.addEventListener('click', () => { resetPreview(); setStatus('Восстановление отменено. Записи не изменены.'); });
      } catch {
        setStatus('');
        preview.innerHTML = `<div class="backup-warning" role="alert"><strong>Не удалось прочитать файл</strong><p class="small-note">Текущие записи не изменены.</p></div>`;
        preview.classList.remove('hidden');
      }
    });

    async function confirmImport() {
      if (!pending) return;
      const button = $('#confirmImportBackup');
      if (button) { button.disabled = true; button.textContent = 'Восстанавливаю…'; }
      try {
        const report = await applyBackup(pending);
        resetPreview();
        setStatus(reportText(report));
        showToast(report.failed.length ? 'Часть записей не удалось восстановить.' : 'Восстановление завершено.');
        if (typeof refresh === 'function') await refresh();
      } catch (error) {
        resetPreview();
        setStatus('');
        showToast(error.message || 'Не удалось восстановить копию.');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initBackup);

  // Для тестов и повторного использования из консоли.
  globalThis.backupCollect = collectBackup;
  globalThis.backupValidate = validateBackup;
  globalThis.backupApply = applyBackup;
  globalThis.backupReportText = reportText;
  globalThis.backupTextKey = textKey;
})();
