/* v30: presentation only. Pair permissions, opening/deleting notes and games stay in app.js/API. */
(() => {
  const q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)];
  const bookViews = ['mailbox', 'conversation', 'homework', 'agreements', 'capsule'];
  const titles = {our:'Наш уголок',mailbox:'Ящик писем',conversation:'Ваш разговор',homework:'Разобрать отдельно',agreements:'Договорённости',capsule:'Капсула тепла',dates:'Ваши свидания',games:'Маленькая игровая'};
  const homeLabels = {decisions:'Выбирает котик',agreements:'Наши договорённости',wishes:'Лист желаний',intimate:'Сексуальные желания'};
  let ready = false, bookPage = 0, readingPages = [], readingKey = '', homeDraft = null;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const icon = key => `<img class="pixel-icon" src="/assets/ui/${key}.svg" alt="" aria-hidden="true">`;

  function applyMode(prefs) {
    const mode = prefs.mode === 'dark' || (prefs.mode === 'system' && system.matches) ? 'dark' : 'light';
    document.documentElement.dataset.mode = mode;
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  }
  const baseApply = applyPersonalization;
  applyPersonalization = function(value) {
    const p = baseApply(value); applyMode(p);
    if (ready) applyHome(p);
    return p;
  };
  system.addEventListener('change', () => applyMode(normalizeClientPreferences(appState?.preferences)));

  const basePersonalization = renderPersonalizationModal;
  renderPersonalizationModal = function() {
    basePersonalization();
    if (!personalizationDraft) return;
    const modes = [['light','Светлая','sun'],['dark','Тёмная','moon'],['system','Как на устройстве','settings']];
    q('#modeChoices').innerHTML = modes.map(([key,label,art])=>`<button type="button" data-mode-choice="${key}" class="mode-choice ${personalizationDraft.mode===key?'selected':''}" aria-pressed="${personalizationDraft.mode===key}">${icon(art)}${label}</button>`).join('');
    all('[data-mode-choice]').forEach(b=>b.onclick=()=>{personalizationDraft.mode=b.dataset.modeChoice;renderPersonalizationModal();});
  };

  function applyHome(p) {
    const grid = q('#ourView .our-grid');
    if (!grid) return;
    const cards = p.homeOrder.map(key=>q(`[data-home-block="${key}"]`)).filter(Boolean);
    const existing = [...grid.children].filter(e=>e.dataset.homeBlock);
    if (activeView === 'our' && (cards.length !== existing.length || cards.some((c,i)=>existing[i]!==c))) cards.forEach(c=>grid.append(c));
    cards.forEach(card=>{
      const key = card.dataset.homeBlock;
      const inBook = activeView === 'agreements' && key === 'agreements';
      card.classList.toggle('home-hidden', !inBook && p.homeHidden.includes(key));
      const heading = card.querySelector('h3');
      const title = p.homeTitles[key] || homeLabels[key];
      if (heading && heading.textContent !== title) heading.textContent = title;
    });
  }
  function renderHomeEditor() {
    if (!homeDraft) return;
    q('#homeEditorRows').innerHTML = homeDraft.homeOrder.map((key,i)=>`<div class="home-editor-row"><label>Название блока<input data-home-title="${key}" value="${escapeHtml(homeDraft.homeTitles[key]||homeLabels[key])}" maxlength="60"></label><div class="home-editor-tools"><label><input type="checkbox" data-home-hidden="${key}" ${homeDraft.homeHidden.includes(key)?'checked':''}> Скрыть</label><button type="button" data-home-move="${i}" data-delta="-1" aria-label="Выше: ${homeLabels[key]}" ${i===0?'disabled':''}>↑</button><button type="button" data-home-move="${i}" data-delta="1" aria-label="Ниже: ${homeLabels[key]}" ${i===3?'disabled':''}>↓</button></div></div>`).join('');
    all('[data-home-title]').forEach(input=>input.oninput=()=>{homeDraft.homeTitles[input.dataset.homeTitle]=input.value;});
    all('[data-home-hidden]').forEach(input=>input.onchange=()=>{const set=new Set(homeDraft.homeHidden);input.checked?set.add(input.dataset.homeHidden):set.delete(input.dataset.homeHidden);homeDraft.homeHidden=[...set];});
    all('[data-home-move]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.homeMove),j=i+Number(b.dataset.delta);[homeDraft.homeOrder[i],homeDraft.homeOrder[j]]=[homeDraft.homeOrder[j],homeDraft.homeOrder[i]];renderHomeEditor();});
  }
  async function saveHome() {
    const button=q('#saveHomeLayout');button.disabled=true;
    try {
      const prefs=normalizeClientPreferences({...appState.preferences,homeOrder:homeDraft.homeOrder,homeHidden:homeDraft.homeHidden,homeTitles:homeDraft.homeTitles});
      const result=await api('/api/preferences',{method:'POST',body:JSON.stringify(prefs)});
      appState.preferences=normalizeClientPreferences(result.preferences);applyPersonalization(appState.preferences);
      q('#homeLayoutEditor').open=false;showToast('Твой уголок сохранён. Расположение партнёра не изменилось.');
    } catch(e){showToast(e.message);}finally{button.disabled=false;}
  }

  function repaintStack() {
    const n=bookPage%3;
    q('#bookStack').innerHTML=Array.from({length:6-n},(_,i)=>`<i style="--sheet:${i}"></i>`).join('');
  }
  function counter() {
    if(!ready||!bookViews.includes(activeView))return;
    const ws=q('#bookWorkspace');
    const isReading=activeView==='conversation' && appState?.opened && readingPages.length;
    const count=isReading?readingPages.length:Math.max(1,Math.ceil((ws.scrollHeight-2)/ws.clientHeight));
    const current=isReading?bookPage:Math.min(count-1,Math.round(ws.scrollTop/ws.clientHeight));
    q('#bookPageLabel').textContent=`${current+1} / ${count}`;
    q('#bookPrev').disabled=current<=0;q('#bookNext').disabled=current>=count-1;
    q('#bookTabTitle').textContent=titles[activeView];
  }
  function animatePage() {
    const paper=q('#bookWorkspace');paper.classList.remove('page-turn');void paper.offsetWidth;paper.classList.add('page-turn');repaintStack();
  }
  function splitText(text,width,height) {
    if(!text)return [''];
    const probe=document.createElement('div');probe.className='reading-measure note-body';
    Object.assign(probe.style,{position:'absolute',left:'-10000px',top:'0',width:width+'px',visibility:'hidden',whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:'16px',lineHeight:'1.65',padding:'0',border:'0'});
    document.body.append(probe);const result=[];let pos=0;
    while(pos<text.length){let low=1,high=text.length-pos,fit=1;
      while(low<=high){const mid=Math.floor((low+high)/2);probe.textContent=text.slice(pos,pos+mid);if(probe.scrollHeight<=height){fit=mid;low=mid+1;}else high=mid-1;}
      // Do not cut a surrogate pair; keep every character, including whitespace.
      if(fit>1 && /[\uD800-\uDBFF]/.test(text[pos+fit-1]) && /[\uDC00-\uDFFF]/.test(text[pos+fit]||''))fit--;
      result.push(text.slice(pos,pos+fit));pos+=fit;
    }
    probe.remove();return result;
  }
  function buildReading() {
    if(!appState?.opened){readingPages=[];readingKey='';bookPage=0;}
    if(!ready||activeView!=='conversation'||!appState?.opened){counter();return;}
    const ws=q('#bookWorkspace'), list=q('#notesList');
    const width=Math.max(120,list.clientWidth-34);
    const textHeight=Math.max(70,ws.clientHeight-230);
    const key=JSON.stringify([appState.notes.map(n=>[n.id,n.body,n.category]),Math.round(width),Math.round(textHeight)]);
    if(key!==readingKey){readingKey=key;readingPages=[];
      appState.notes.forEach((n,index)=>{const chunks=splitText(n.body,width,textHeight);chunks.forEach((text,part)=>readingPages.push({index,text,part,total:chunks.length}));});
      readingPages.push({outcome:true});bookPage=Math.min(bookPage,readingPages.length-1);
    }
    paintReading();
  }
  function paintReading() {
    if(!readingPages.length)return;
    const current=readingPages[bookPage]||readingPages[0];
    all('#notesList .note-item').forEach((article,i)=>{
      article.classList.toggle('hidden',current.outcome||i!==current.index);
      if(!current.outcome && i===current.index){
        article.querySelector('.note-body').textContent=current.text;
        article.querySelector('.note-actions')?.classList.toggle('hidden',current.part<current.total-1);
      }
    });
    q('#notesList').classList.toggle('hidden',!!current.outcome);
    q('#talkOutcomeCard').classList.toggle('book-suppressed',!current.outcome);
    q('.finish-row').classList.toggle('book-suppressed',!current.outcome);
    q('#readingContinuation').textContent=current.outcome?'Маленький итог разговора':`Письмо ${current.index+1} · лист ${current.part+1} / ${current.total}`;
    q('#bookWorkspace').scrollTop=0;counter();
  }
  function goPage(delta) {
    if(activeView==='conversation'&&appState?.opened&&readingPages.length){
      bookPage=Math.max(0,Math.min(readingPages.length-1,bookPage+delta));paintReading();
    } else {q('#bookWorkspace').scrollBy({top:delta*q('#bookWorkspace').clientHeight,behavior:'auto'});bookPage++;}
    animatePage();counter();
  }

  const baseSwitch=switchView;
  switchView=function(view){
    if(![...bookViews,'our','dates','games'].includes(view))view='our';
    const previous=activeView;
    if(ready && view==='agreements')q('#agreementsView').append(q('[data-home-block="agreements"]'));
    if(ready && view!=='our')q('#intimateGate')?.removeAttribute('open');
    baseSwitch(view);
    if(!ready)return;
    document.body.dataset.view=view;
    q('#letterBook').classList.toggle('hidden',!bookViews.includes(view));
    q('#pageHeading').textContent=titles[view]+'.';
    q('#pageLead').textContent=view==='our'?'Маленькое место для вашей большой истории.':view==='dates'?'Оставьте немного времени друг для друга.':view==='games'?'Можно просто побыть рядом и поиграть.':'Слова, которым здесь есть место.';
    all('.main-tab').forEach(b=>b.setAttribute('aria-current',b.classList.contains('active')?'page':'false'));
    all('.mailbox-subtab').forEach(b=>{const selected=b.dataset.mailboxView===view;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    if(previous!==view){bookPage=0;readingKey='';q('#bookWorkspace').scrollTop=0;animatePage();}
    applyHome(normalizeClientPreferences(appState?.preferences));buildReading();counter();
  };
  const baseRender=renderState;
  renderState=function(){
    // Keep the currently read letter/page stable across the existing 20-second refresh.
    baseRender();
    if(ready){const local=q('#localModeLabel');if(local)local.hidden=document.documentElement.dataset.storage!=='local';applyHome(normalizeClientPreferences(appState?.preferences));buildReading();counter();}
  };
  const baseShow=showApp;
  showApp=function(){const first=q('#appView').classList.contains('hidden');baseShow();if(first&&ready)switchView('our');};
  const baseAuth=showAuth;
  showAuth=function(tab){baseAuth(tab);q('#intimateGate')?.removeAttribute('open');readingPages=[];readingKey='';bookPage=0;};

  document.addEventListener('DOMContentLoaded',()=>{
    const nav=q('.main-tabs');
    const brand=document.createElement('button');brand.className='side-brand';brand.type='button';brand.innerHTML=`<img src="/icon.svg?v=30" alt=""><span>тихий<br>ящик<span class="brand-stop">.</span></span>`;brand.onclick=()=>switchView('our');
    const sidebar=document.createElement('aside');sidebar.className='quiet-sidebar';sidebar.append(brand);
    const caption=document.createElement('p');caption.className='sidebar-caption';caption.textContent='МЕСТО ДЛЯ ВАС ДВОИХ';sidebar.append(caption,nav);
    const small=document.createElement('div');small.className='sidebar-foot';small.innerHTML=`${icon('heart')}<p>Не всё нужно решать сразу.<br>Здесь можно быть собой.</p><button type="button" id="quickAppearance">${icon('moon')}Твой вид</button>`;sidebar.append(small);q('#appView').prepend(sidebar);q('#quickAppearance').onclick=openPersonalization;
    const editor=document.createElement('details');editor.id='homeLayoutEditor';editor.className='home-layout-editor';editor.innerHTML='<summary>Настроить мой уголок</summary><p class="small-note">Названия, порядок и видимость — только для тебя. Содержимое общих записей остаётся общим.</p><div id="homeEditorRows"></div><button id="saveHomeLayout" class="button primary" type="button">Сохранить мой уголок</button>';
    q('#ourView').prepend(editor);editor.addEventListener('toggle',()=>{if(editor.open){homeDraft=normalizeClientPreferences(appState?.preferences);renderHomeEditor();}});q('#saveHomeLayout').onclick=saveHome;
    const selectors={decisions:'.decisions-card',agreements:'.agreements-card',wishes:'.wishes-card:not(.intimate-wishes-card)',intimate:'.intimate-wishes-card'};
    for(const [key,selector] of Object.entries(selectors))q(selector).dataset.homeBlock=key;
    const intimate=q('.intimate-wishes-card');const gate=document.createElement('details');gate.id='intimateGate';gate.innerHTML='<summary>Открыть личный раздел</summary>';
    const preserved=[...intimate.childNodes].filter(n=>n.nodeType!==1||!n.matches('h3,.card-kicker'));preserved.forEach(n=>gate.append(n));intimate.append(gate);
    const book=document.createElement('section');book.id='letterBook';book.className='letter-book hidden';book.setAttribute('aria-label','Книга писем');
    book.innerHTML='<div id="bookStack" class="book-stack" aria-hidden="true"></div><div class="book-cover"><div class="book-ribbon"></div><div class="book-topline"><span>ТИХИЙ ЯЩИК · ВАШИ ПИСЬМА</span><span id="bookTabTitle"></span></div><div id="bookWorkspace" class="book-workspace"></div><footer class="book-footer"><button id="bookPrev" type="button" aria-label="Предыдущая страница">←</button><span id="bookPageLabel" aria-live="polite">1 / 1</span><button id="bookNext" type="button" aria-label="Следующая страница">→</button></footer></div>';
    q('.app-main').append(book);book.prepend(q('#mailboxSubnav'));
    for(const view of bookViews)q('#bookWorkspace').append(q('#'+view+'View'));
    const schedule=q('#conversationView .date-controls-card');const scheduleFold=document.createElement('details');scheduleFold.className='book-schedule';scheduleFold.innerHTML='<summary>Когда поговорить?</summary>';schedule.before(scheduleFold);scheduleFold.append(schedule);
    const continuation=document.createElement('p');continuation.id='readingContinuation';continuation.className='reading-continuation';q('#revealedSection .section-heading').after(continuation);
    q('#bookWorkspace').addEventListener('scroll',counter,{passive:true});q('#bookPrev').onclick=()=>goPage(-1);q('#bookNext').onclick=()=>goPage(1);
    // Preserve existing game logic, replacing only smooth game-piece artwork.
    const cat=q('#tttScoreMine svg');if(cat)cat.outerHTML=icon('cat');
    ready=true;applyMode(normalizeClientPreferences(appState?.preferences));switchView('our');
    document.fonts.ready.then(()=>{readingKey='';buildReading();});
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{readingKey='';buildReading();counter();},100);});
    // Announce the pre-existing local fallback honestly; never present it as cloud sync.
    const label=document.createElement('span');label.id='localModeLabel';label.hidden=true;label.className='storage-label';label.textContent='Локальный режим';q('.top-actions').prepend(label);
  });
})();
