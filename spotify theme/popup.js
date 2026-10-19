(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const extension = typeof chrome !== 'undefined' && !!chrome.storage?.local;
  let settings = Aura.normalize();
  let filter = 'all';
  let query = '';
  let spotifyTab = null;
  let toastTimeout;
  let sleepUntil = 0;
  let saving = Promise.resolve();
  const storage = extension ? chrome.storage.local : {
    async get() { try { return JSON.parse(localStorage.getItem('aura-preview') || '{}'); } catch { return {}; } },
    async set(value) { localStorage.setItem('aura-preview',JSON.stringify({...await this.get(),...value})); }
  };
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'),3400);
  }
  function visibleThemes() { return Aura.themes.filter(theme => Aura.matchesTheme(theme,filter,query)); }
  function selectTheme(id) {
    save({theme:id,accent:'',background:'',enabled:true});
    toast(`${Aura.getTheme(id).name} — your new atmosphere.`);
  }
  function renderThemes() {
    const grid = $('#theme-grid');
    grid.replaceChildren();
    const results = visibleThemes();
    $('#theme-count').textContent = String(Aura.themes.length).padStart(2,'0');
    $('#theme-results').textContent = `${results.length} ${results.length === 1 ? 'atmosphere' : 'atmospheres'} to make your own`;
    $('#empty-themes').hidden = results.length > 0;
    $('#surprise').disabled = results.length === 0;
    for (const theme of results) {
      const card = document.createElement('button');
      card.className = 'theme-card';
      card.dataset.theme = theme.id;
      card.setAttribute('aria-pressed',String(settings.theme === theme.id));
      card.setAttribute('aria-label',`Apply ${theme.name} theme`);
      // All interpolated values below come exclusively from bundled theme data.
      card.innerHTML = `<img class="theme-art" src="${Aura.thumbnail(theme)}" alt="" width="178" height="98" loading="lazy" decoding="async"><span class="selected-badge" aria-hidden="true">✓</span><span class="theme-info"><span class="theme-title">${theme.name}<span class="swatches" aria-hidden="true"><i style="background:${theme.accent}"></i><i style="background:${theme.panel}"></i><i style="background:${theme.bg}"></i></span></span><span class="theme-label">${theme.label}</span></span>`;
      grid.append(card);
    }
  }
  function renderFonts() {
    for (const font of Aura.fonts) {
      const option = document.createElement('label');
      option.className = 'font-option';
      option.innerHTML = `<input type="radio" name="font" value="${font.id}"><span class="font-option-body"><span class="font-sample" aria-hidden="true">${font.sample}</span><span><strong>${font.name}</strong><small>${font.note}</small></span><span class="font-check" aria-hidden="true">✓</span></span>`;
      option.querySelector('.font-sample').style.fontFamily = font.family || 'system-ui, sans-serif';
      $('#font-grid').append(option);
    }
  }
  function render() {
    const theme = Aura.getTheme(settings.theme);
    for (const key of ['enabled','focus','compact','reduceMotion']) $(`#${key}`).checked = settings[key];
    $('#accent').value = settings.accent || theme.accent;
    $('#dim').value = settings.dim;
    $('#dim-value').value = `${settings.dim}%`;
    $('#remove-background').hidden = !settings.background;
    $('#preview-name').textContent = theme.name;
    $('#preview-desc').textContent = theme.description;
    $('#preview-note').textContent = settings.enabled ? (settings.background ? 'Your wallpaper. Your world.' : 'A preview of your atmosphere') : 'Themes are paused';
    $('.preview').style.setProperty('--preview-image',`url("${settings.background || Aura.artwork(theme)}")`);
    $('.preview').style.setProperty('--preview-accent',settings.accent || theme.accent);
    $('.preview').style.setProperty('--preview-shade',String(settings.dim / 100));
    $('#preview-name').style.fontFamily = Aura.getFont(settings.font).family;
    $$('input[name="font"]').forEach(input => input.checked = input.value === settings.font);
    document.body.classList.toggle('paused',!settings.enabled);
    $$('.theme-card').forEach(card => card.setAttribute('aria-pressed',String(card.dataset.theme === settings.theme)));
  }
  function save(patch) {
    settings = Aura.normalize({...settings,...patch});
    const snapshot = {...settings};
    render();
    saving = saving.then(() => storage.set({settings:snapshot})).catch(() => toast('Couldn’t save your change. Please try again.'));
    return saving;
  }
  function selectTab(id) {
    $$('[data-tab]').forEach(tab => {
      const selected = tab.dataset.tab === id;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#panel-${tab.dataset.tab}`).hidden = !selected;
    });
    if (id === 'tools') refreshPlayer();
  }
  async function refreshPlayer() {
    if (!extension) {
      $('#connection-label').textContent = 'Design preview · install to connect';
      $$('[data-control], [data-minutes]').forEach(button => button.disabled = true);
      return;
    }
    try {
      const tabs = await chrome.tabs.query({url:'https://open.spotify.com/*'});
      tabs.sort((a,b) => Number(b.active)-Number(a.active) || (b.lastAccessed || 0)-(a.lastAccessed || 0));
      let state = null;
      spotifyTab = null;
      // Prefer a tab with an actual player, falling back to an open Spotify page.
      for (const tab of tabs) {
        try {
          const candidate = await chrome.tabs.sendMessage(tab.id,{type:'AURA_STATUS'});
          if (candidate && (!state || candidate.playing || (!state.available && candidate.available))) { spotifyTab = tab; state = candidate; }
          if (state?.playing) break;
        } catch { /* A tab opened before installation needs one refresh. */ }
      }
      $('#connection').classList.toggle('connected',!!spotifyTab);
      $('#connection-label').textContent = spotifyTab ? (settings.enabled ? 'Connected to Spotify · all saved locally' : 'Connected · themes are paused') : tabs.length ? 'Refresh Spotify once to connect Aura' : 'Your Spotify is one click away';
      $('#open-spotify').textContent = tabs.length ? 'Go to Spotify ↗' : 'Open Spotify ↗';
      $('#track-title').textContent = state?.title || 'Your next favorite awaits';
      $('#track-artist').textContent = state?.artist || (spotifyTab ? 'Start a song in Spotify' : 'Open Spotify to start listening');
      $('#play-pause').textContent = state?.playing ? 'Ⅱ' : '▶︎';
      $$('[data-control]').forEach(button => button.disabled = !state?.available);
    } catch { $('#connection-label').textContent = 'Couldn’t reach Spotify. Reopen Aura to retry.'; }
  }
  function renderTimer() {
    const remaining = sleepUntil - Date.now();
    $('#timer-label').textContent = remaining > 0 ? `☾ Pausing in ${Math.ceil(remaining/60000)} min` : 'No timer set';
    $('#cancel-timer').hidden = remaining <= 0;
  }
  async function setTimer(minutes) {
    if (!extension) return;
    try {
      const result = await chrome.runtime.sendMessage({type:'AURA_TIMER',minutes});
      if (!result?.ok) throw new Error(result?.error || 'Timer unavailable. Please try again.');
      sleepUntil = result.when || 0;
      renderTimer();
      toast(minutes ? `Sleep timer set for ${minutes} minutes.` : 'Sleep timer cancelled.');
    } catch (error) { toast(error.message); }
  }
  async function upload(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return toast('Choose a JPG, PNG, or WebP image.');
    if (file.size > 8*1024*1024) return toast('Choose an image smaller than 8 MB.');
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1,1600/Math.max(image.width,image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.width*scale));
      canvas.height = Math.max(1,Math.round(image.height*scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#141321';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      image.close();
      const background = canvas.toDataURL('image/jpeg',.82);
      if (background.length > 1500000) return toast('This image is too detailed. Try a smaller version.');
      await save({background});
      toast('Your wallpaper is ready. Make yourself at home.');
    } catch { toast('Couldn’t read that image. Try another file.'); }
    finally { $('#background-file').value = ''; }
  }
  async function init() {
    try {
      const data = await storage.get(['settings','sleepUntil']);
      settings = Aura.normalize(data.settings);
      sleepUntil = data.sleepUntil || 0;
    } catch { toast('Couldn’t load saved preferences. Defaults are ready.'); }
    renderThemes(); renderFonts(); render(); renderTimer();
    $('.brand').addEventListener('click',event => { event.preventDefault(); selectTab('themes'); });
    $('#theme-grid').addEventListener('click',event => {
      const card = event.target.closest('[data-theme]');
      if (!card) return;
      selectTheme(card.dataset.theme);
    });
    $('#font-grid').addEventListener('change',event => {
      if (event.target.matches('input[name="font"]')) save({font:event.target.value});
    });
    $('#theme-search').addEventListener('input',event => { query = event.target.value; renderThemes(); });
    $('#surprise').addEventListener('click',() => {
      const results = visibleThemes();
      const alternatives = results.filter(theme => theme.id !== settings.theme);
      const pool = alternatives.length ? alternatives : results;
      if (pool.length) selectTheme(pool[Math.floor(Math.random()*pool.length)].id);
    });
    $('#clear-search').addEventListener('click',() => {
      query = ''; filter = 'all'; $('#theme-search').value = '';
      $$('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item.dataset.filter === 'all')));
      renderThemes(); $('#theme-search').focus();
    });
    $$('[data-filter]').forEach(button => button.addEventListener('click',() => {
      filter = button.dataset.filter;
      $$('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
      renderThemes();
    }));
    $$('[data-tab]').forEach(button => {
      button.addEventListener('click',() => selectTab(button.dataset.tab));
      button.addEventListener('keydown',event => {
        const tabs = $$('[data-tab]');
        let index = tabs.indexOf(button);
        if (event.key === 'ArrowRight') index = (index+1)%tabs.length;
        else if (event.key === 'ArrowLeft') index = (index+tabs.length-1)%tabs.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = tabs.length-1;
        else return;
        event.preventDefault(); selectTab(tabs[index].dataset.tab); tabs[index].focus();
      });
    });
    for (const key of ['enabled','focus','compact','reduceMotion']) $(`#${key}`).addEventListener('change',event => { save({[key]:event.target.checked}); if (key === 'enabled') refreshPlayer(); });
    $('#accent').addEventListener('input',event => save({accent:event.target.value}));
    $('#reset-accent').addEventListener('click',() => save({accent:''}));
    $('#dim').addEventListener('input',event => save({dim:Number(event.target.value)}));
    $('#background-file').addEventListener('change',event => upload(event.target.files[0]));
    $('#remove-background').addEventListener('click',() => save({background:''}));
    $('#reset-all').addEventListener('click',() => { save({...Aura.defaults}); toast('A fresh start. Default appearance restored.'); });
    $$('[data-minutes]').forEach(button => button.addEventListener('click',() => setTimer(Number(button.dataset.minutes))));
    $('#cancel-timer').addEventListener('click',() => setTimer(0));
    $$('[data-control]').forEach(button => button.addEventListener('click',async () => {
      if (!spotifyTab) return;
      try {
        const result = await chrome.tabs.sendMessage(spotifyTab.id,{type:'AURA_CONTROL',action:button.dataset.control});
        if (!result?.ok) toast(result?.error || 'Open Spotify and start a song first.');
        setTimeout(refreshPlayer,250);
      } catch { toast('Refresh Spotify to reconnect the player.'); refreshPlayer(); }
    }));
    $('#open-spotify').addEventListener('click',async () => {
      if (!extension) { window.open('https://open.spotify.com/','_blank','noopener'); return; }
      const tabs = await chrome.tabs.query({url:'https://open.spotify.com/*'});
      if (tabs.length) { await chrome.tabs.update(tabs[0].id,{active:true}); await chrome.windows.update(tabs[0].windowId,{focused:true}); }
      else await chrome.tabs.create({url:'https://open.spotify.com/'});
    });
    if (extension) chrome.storage.onChanged.addListener((changes,area) => {
      if (area === 'local' && changes.sleepUntil) { sleepUntil = changes.sleepUntil.newValue || 0; renderTimer(); }
    });
    refreshPlayer();
    // Only runs while the popup is visible; no polling on Spotify itself.
    setInterval(() => { if (!document.hidden) { renderTimer(); if (!$('#panel-tools').hidden) refreshPlayer(); } },5000);
  }
  init();
})();
