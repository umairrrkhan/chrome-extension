'use strict';
const defaults = { enabled: true, weapon: 'rpg', sound: false };
let settings = { ...defaults };
const toggles = ['enabled', 'sound'].map(key => [key, document.getElementById(key)]);
const weapons = [...document.querySelectorAll('[data-weapon]')];
const error = document.getElementById('error');

function render() {
  for (const [key, element] of toggles) {
    element.classList.toggle('on', settings[key]);
    element.setAttribute('aria-pressed', settings[key]);
  }
  for (const button of weapons) {
    const selected = button.dataset.weapon === settings.weapon;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected);
  }
  document.getElementById('status').textContent = settings.enabled
    ? 'Ready when you are' : 'Paused until you need it';
}

async function save(patch) {
  const previous = { ...settings };
  Object.assign(settings, patch);
  error.hidden = true;
  render();
  try {
    await chrome.storage.local.set(patch);
  } catch {
    for (const key of Object.keys(patch)) {
      if (settings[key] === patch[key]) settings[key] = previous[key];
    }
    error.textContent = 'Could not save settings. Please try again.';
    error.hidden = false;
    render();
  }
}

for (const [key, element] of toggles) {
  element.onclick = () => save({ [key]: !settings[key] });
}
for (const button of weapons) {
  button.disabled = true;
  button.onclick = () => save({ weapon: button.dataset.weapon });
}
document.getElementById('playground').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') });
document.getElementById('open-x').onclick = () => chrome.tabs.create({ url: 'https://x.com/home' });
chrome.storage.local.get(defaults).then(saved => {
  settings = { ...defaults, ...saved };
}).catch(() => {
  error.textContent = 'Settings could not be loaded. Try reopening the extension.';
  error.hidden = false;
}).finally(() => {
  render();
  toggles.forEach(([, element]) => { element.disabled = false; });
  weapons.forEach(button => { button.disabled = false; });
});
