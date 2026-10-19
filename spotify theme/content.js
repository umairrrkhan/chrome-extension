(() => {
  'use strict';
  const root = document.documentElement;
  const variables = ['accent','bg','panel','text','image','shade'];
  let settings = Aura.normalize();
  let revision = 0;
  function apply(value) {
    settings = Aura.normalize(value);
    for (const key of ['aura','auraCompact','auraFocus','auraMotion']) delete root.dataset[key];
    for (const name of variables) root.style.removeProperty(`--aura-${name}`);
    if (!settings.enabled) return;
    const theme = Aura.getTheme(settings.theme);
    root.dataset.aura = theme.id;
    if (settings.compact) root.dataset.auraCompact = '';
    if (settings.focus) root.dataset.auraFocus = '';
    if (settings.reduceMotion) root.dataset.auraMotion = '';
    const image = settings.background || chrome.runtime.getURL(`assets/${theme.art}.svg`);
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
