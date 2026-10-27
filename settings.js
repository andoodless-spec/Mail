/* Настройки как выдвижная панель: четыре вкладки, как в «Поляне».
   Этот файл только переключает вкладки и подписи — сами настройки живут
   в app.js и backup.js, чтобы не дублировать логику. */
(() => {
  const TABS = ['appearance', 'layout', 'alerts', 'account'];
  const DEFAULT_TAB = 'appearance';

  function panelOf(key) {
    return document.querySelector(`[data-settings-panel="${key}"]`);
  }

  function activate(key, focus = false) {
    if (!TABS.includes(key)) key = DEFAULT_TAB;
    document.querySelectorAll('[data-settings-tab]').forEach((button) => {
      const selected = button.dataset.settingsTab === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    TABS.forEach((name) => panelOf(name)?.classList.toggle('hidden', name !== key));
    document.querySelector('.settings-modal-card')?.setAttribute('data-settings-active', key);
  }

  // Честная подпись про хранилище: локальный режим — это только этот браузер.
  function paintAccountNote() {
    const note = document.querySelector('#accountSyncNote');
    if (!note) return;
    const storage = document.documentElement.dataset.storage;
    if (storage === 'cloud') note.textContent = 'Синхронизировано с облаком';
    else if (storage === 'local') note.textContent = 'Локальный режим: записи только в этом браузере';
    else note.textContent = 'Проверяю, где хранятся записи…';
  }

  function open(key = DEFAULT_TAB) {
    if (typeof openModal === 'function') openModal('settingsModal');
    else document.querySelector('#settingsModal')?.classList.remove('hidden');
    // Черновик оформления нужен всегда, иначе вкладка «Оформление» будет пустой.
    if (key === 'appearance' && typeof openPersonalization === 'function') {
      openPersonalization();
      return;
    }
    activate(key);
    paintAccountNote();
  }

  function prepare(key) {
    // Вызывается перед открытием: черновик и подписи должны быть свежими.
    if (key === 'appearance' && typeof openPersonalization === 'function') openPersonalization();
    else { activate(key); paintAccountNote(); }
  }

  function init() {
    const tabs = [...document.querySelectorAll('[data-settings-tab]')];
    if (!tabs.length) return;
    tabs.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.settingsTab;
        if (key === 'appearance' && typeof openPersonalization === 'function' && !personalizationDraft) openPersonalization();
        activate(key);
        paintAccountNote();
      });
      button.addEventListener('keydown', (event) => {
        const index = TABS.indexOf(button.dataset.settingsTab);
        let target = null;
        if (event.key === 'ArrowRight') target = TABS[(index + 1) % TABS.length];
        else if (event.key === 'ArrowLeft') target = TABS[(index - 1 + TABS.length) % TABS.length];
        else if (event.key === 'Home') target = TABS[0];
        else if (event.key === 'End') target = TABS[TABS.length - 1];
        if (!target) return;
        event.preventDefault();
        if (target === 'appearance' && typeof openPersonalization === 'function' && !personalizationDraft) openPersonalization();
        activate(target, true);
        paintAccountNote();
      });
    });
    // Из меню ⋯ открывается сразу «Аккаунт и данные», как профиль в «Поляне».
    document.querySelector('#settingsButton')?.addEventListener('click', () => setTimeout(() => prepare('account'), 0));
    activate(DEFAULT_TAB);
  }

  document.addEventListener('DOMContentLoaded', init);
  globalThis.settingsActivateTab = activate;
  globalThis.settingsOpen = open;
  globalThis.settingsPrepare = prepare;
})();
