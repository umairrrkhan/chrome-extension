(() => {
  'use strict';
  const root = document.documentElement;
  const variables = ['accent','bg','panel','text','image','shade','font'];
  let settings = Aura.normalize();
  let revision = 0;
  function syncCompanion() {
    const theme = Aura.getTheme(settings.theme);
    const existing = document.getElementById('aura-companion');
    if (!settings.enabled || !settings.companion || !theme.companion) { existing?.remove(); return; }
    if (!document.body) return;
    const image = existing || document.createElement('img');
    if (!existing) {
      image.id = 'aura-companion';
      image.alt = '';
      image.setAttribute('aria-hidden','true');
      image.draggable = false;
      image.decoding = 'async';
    }
    if (image.dataset.theme !== theme.id) {
      image.src = chrome.runtime.getURL(theme.companion);
      image.dataset.theme = theme.id;
    }
    if (!existing) document.body.append(image);
  }
  // Content scripts start before body exists. One lifecycle event is enough;
  // settings updates handle all subsequent changes without DOM observers.
  document.addEventListener('DOMContentLoaded',syncCompanion,{once:true});
  function apply(value) {
    settings = Aura.normalize(value);
    syncCompanion();
    for (const key of ['aura','auraCompact','auraFocus','auraMotion','auraFont']) delete root.dataset[key];
    for (const name of variables) root.style.removeProperty(`--aura-${name}`);
    if (!settings.enabled) return;
    const theme = Aura.getTheme(settings.theme);
    root.dataset.aura = theme.id;
    if (settings.compact) root.dataset.auraCompact = '';
    if (settings.focus) root.dataset.auraFocus = '';
    if (settings.reduceMotion) root.dataset.auraMotion = '';
    if (settings.font !== 'default') {
      root.dataset.auraFont = settings.font;
      root.style.setProperty('--aura-font',Aura.getFont(settings.font).family);
    }
    const image = settings.background || chrome.runtime.getURL(theme.backdrop || Aura.artwork(theme));
    const values = {accent:settings.accent || theme.accent, bg:theme.bg, panel:theme.panel, text:theme.text, image:`url("${image}")`, shade:String(settings.dim / 100)};
    for (const [name,value] of Object.entries(values)) root.style.setProperty(`--aura-${name}`,value);
  }
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && changes.settings) { revision++; apply(changes.settings.newValue); }
  });
  const initialRevision = revision;
  chrome.storage.local.get('settings').then(data => { if (revision === initialRevision) apply(data.settings); }).catch(() => {});
  const selectors = {
    toggle:'[data-testid="control-button-playpause"]',
    next:'[data-testid="control-button-skip-forward"]',
    previous:'[data-testid="control-button-skip-back"]'
  };
  function isPlaying() {
    const play = document.querySelector(selectors.toggle);
    return [...document.querySelectorAll('audio,video')].some(media => !media.paused && !media.ended)
      || play?.getAttribute('aria-label')?.toLowerCase() === 'pause'
      || !!play?.querySelector('[data-testid="pause-icon"]');
  }
  function playerState() {
    const play = document.querySelector(selectors.toggle);
    return {
      available:!!play,
      playing:isPlaying(),
      title:document.querySelector('[data-testid="context-item-link"]')?.textContent?.trim() || '',
      artist:document.querySelector('[data-testid="context-item-info-subtitles"]')?.textContent?.trim() || ''
    };
  }
  chrome.runtime.onMessage.addListener((message,sender,respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'AURA_STATUS') { respond(playerState()); return; }
    if (message.type !== 'AURA_CONTROL') return;
    let selector = selectors[message.action];
    if (message.action === 'pause') {
      if (!isPlaying()) { respond({ok:true}); return; }
      selector = selectors.toggle;
    }
    const button = selector && document.querySelector(selector);
    if (button && !button.disabled) { button.click(); respond({ok:true}); }
    else respond({ok:false,error:'Start a song in the Spotify web player first.'});
  });
})();
