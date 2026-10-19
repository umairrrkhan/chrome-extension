const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {normalize,defaults,themes,fonts,getTheme,getFont,artwork,thumbnail,matchesTheme} = require('../core.js');
const root = path.resolve(__dirname,'..');

test('corrupt stored settings safely recover without allowing CSS or URL injection',() => {
  for (const value of [null,undefined,0,'hello',[],{theme:'unknown',accent:'red; background: url(https://example.com)',background:'https://example.com/image.png',focus:'true',dim:NaN}]) {
    assert.deepEqual(normalize(value),{...defaults});
  }
  assert.equal(normalize({dim:120}).dim,80);
  assert.equal(normalize({dim:-5}).dim,0);
  assert.equal(normalize({dim:23.6}).dim,24);
  assert.equal(normalize({background:'data:image/svg+xml;base64,PHN2Zz4='}).background,'');
  assert.equal(normalize({background:'data:image/jpeg;base64,YQ=="; color:red'}).background,'');
  assert.equal(normalize({background:'data:image/jpeg;base64,'+'a'.repeat(1500000)}).background,'');
});

test('valid custom appearance survives storage round trip and unknown keys are discarded',() => {
  const input = {...defaults,theme:'sakura',accent:'#aAbB00',dim:63,focus:true,background:'data:image/jpeg;base64,YQ=='};
  const saved = normalize(JSON.parse(JSON.stringify({...input,tracking:'discard'})));
  assert.deepEqual(saved,input);
  assert.equal(normalize(saved).background,input.background);
  assert.equal(defaults.theme,'midnight');
});

test('manifest only grants Spotify access and every declared resource exists',() => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['storage','alarms']);
  assert.deepEqual(manifest.host_permissions,['https://open.spotify.com/*']);
  const resources = [manifest.action.default_popup,manifest.background.service_worker,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(script=>[...script.js,...script.css]),...themes.flatMap(t=>[artwork(t),thumbnail(t)])];
  for (const file of resources) assert.ok(fs.existsSync(path.join(root,file)),file);
  assert.equal(new Set(themes.map(t=>t.id)).size,12);
  for (const theme of themes) assert.match(theme.accent,/^#[a-f0-9]{6}$/i);
  for (const theme of themes.filter(t=>!t.format)) assert.ok(!fs.readFileSync(path.join(root,artwork(theme)),'utf8').includes('<script'));
});

test('font preferences migrate old settings, persist valid presets, and reject injected font CSS',() => {
  assert.equal(normalize({theme:'sakura'}).font,'default');
  for (const font of fonts) assert.equal(normalize(JSON.parse(JSON.stringify({font:font.id}))).font,font.id);
  for (const value of ['Unknown',null,12,'serif; color:red','url(https://example.com/font)']) assert.equal(normalize({font:value}).font,'default');
  assert.equal(getFont('unknown').id,'default');
  assert.equal(getTheme('unknown').id,'midnight','Adding themes must not change the fallback theme');
});

test('anime and waifu filters overlap while search and category combine correctly',() => {
  assert.equal(themes.filter(t=>matchesTheme(t,'anime')).length,4);
  assert.equal(themes.filter(t=>matchesTheme(t,'waifu')).length,2);
  assert.equal(themes.filter(t=>matchesTheme(t,'waifu',' MOONLIGHT '))[0].id,'moonlight-waifu');
  assert.equal(themes.filter(t=>matchesTheme(t,'minimal','rose')).length,1);
  assert.equal(themes.filter(t=>matchesTheme(t,'anime','matcha')).length,0);
  assert.equal(themes.filter(t=>matchesTheme(t,'all','<img src=x>')).length,0);
});

function background() {
  let onMessage,onAlarm,onStartup,onInstalled;
  const alarms = new Map();
  const data = {};
  const sent = [];
  const chrome = {
    runtime:{id:'test',getURL:p=>`chrome-extension://test/${p}`,onMessage:{addListener:fn=>onMessage=fn},onStartup:{addListener:fn=>onStartup=fn},onInstalled:{addListener:fn=>onInstalled=fn}},
    storage:{local:{async get(key){return {[key]:data[key]};},async set(value){Object.assign(data,value);},async remove(key){delete data[key];}}},
    alarms:{async clear(name){alarms.delete(name);},async create(name,value){alarms.set(name,value);},onAlarm:{addListener:fn=>onAlarm=fn}},
    tabs:{async query(){return [{id:1},{id:2}];},async sendMessage(id,message){sent.push({id,...message});if(id===2)throw new Error('closed tab');}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{chrome,Date,Promise,Error});
  const sender = {id:'test',url:'chrome-extension://test/popup.html'};
  return {data,alarms,sent,alarm:alarm=>onAlarm(alarm),startup:()=>onStartup(),installed:()=>onInstalled(),message:(message,from=sender)=>new Promise(resolve=>{if(onMessage(message,from,resolve)!==true)resolve(undefined);})};
}

test('sleep timer persists beyond the popup and cancels cleanly',async() => {
  const bg=background();
  const start=Date.now();
  const response=await bg.message({type:'AURA_TIMER',minutes:30});
  assert.equal(response.ok,true);
  assert.ok(response.when>=start+30*60000);
  assert.equal(bg.data.sleepUntil,response.when);
  assert.equal(bg.alarms.get('aura-sleep').when,response.when);
  const invalid=await bg.message({type:'AURA_TIMER',minutes:-2});
  assert.equal(invalid.ok,false);
  assert.equal(bg.alarms.get('aura-sleep').when,response.when);
  assert.equal((await bg.message({type:'AURA_TIMER',minutes:0})).ok,true);
  assert.equal(bg.alarms.size,0);
  assert.equal(bg.data.sleepUntil,undefined);
});

test('timer rejects messages from a web page or another extension',async() => {
  const bg=background();
  assert.equal(await bg.message({type:'AURA_TIMER',minutes:15},{id:'other',url:'chrome-extension://test/popup.html'}),undefined);
  assert.equal(await bg.message({type:'AURA_TIMER',minutes:15},{id:'test',url:'https://open.spotify.com/'}),undefined);
  assert.equal(bg.alarms.size,0);
});

test('timer pauses every Spotify tab, tolerates closed tabs, and clears saved deadline',async() => {
  const bg=background();
  await bg.message({type:'AURA_TIMER',minutes:15});
  await bg.alarm({name:'unrelated'});
  assert.equal(bg.sent.length,0);
  await bg.alarm({name:'aura-sleep'});
  assert.equal(bg.sent.length,2);
  assert.ok(bg.sent.every(message=>message.type==='AURA_CONTROL'&&message.action==='pause'));
  assert.equal(bg.data.sleepUntil,undefined);
});

test('browser restart restores an alarm even when its deadline passed during sleep',async() => {
  const bg=background();
  bg.data.sleepUntil=Date.now()-60000;
  const now=Date.now();
  await bg.startup();
  assert.ok(bg.alarms.get('aura-sleep').when>=now);
  bg.data.sleepUntil=Date.now()+600000;
  await bg.installed();
  assert.equal(bg.alarms.get('aura-sleep').when,bg.data.sleepUntil);
});
