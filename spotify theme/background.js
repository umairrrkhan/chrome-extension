'use strict';
const TIMER = 'aura-sleep';
// A real Chrome alarm survives the popup closing and worker suspension.
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  if (message.type !== 'AURA_TIMER') return;
  (async () => {
    if (![0,15,30,45,60].includes(message.minutes)) throw new Error('Choose a valid timer.');
    await chrome.alarms.clear(TIMER);
    if (message.minutes === 0) {
      await chrome.storage.local.remove('sleepUntil');
      respond({ok:true});
      return;
    }
    const when = Date.now() + message.minutes * 60000;
    await chrome.alarms.create(TIMER,{when});
    await chrome.storage.local.set({sleepUntil:when});
    respond({ok:true,when});
  })().catch(error => respond({ok:false,error:error.message}));
  return true;
});
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== TIMER) return;
  const tabs = await chrome.tabs.query({url:'https://open.spotify.com/*'});
  await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id,{type:'AURA_CONTROL',action:'pause'})));
  await chrome.storage.local.remove('sleepUntil');
});
async function restoreTimer() {
  const {sleepUntil} = await chrome.storage.local.get('sleepUntil');
  if (Number.isFinite(sleepUntil)) await chrome.alarms.create(TIMER,{when:Math.max(Date.now()+1000,sleepUntil)});
}
chrome.runtime.onStartup.addListener(restoreTimer);
chrome.runtime.onInstalled.addListener(restoreTimer);
