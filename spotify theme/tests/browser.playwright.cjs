/* Optional UI integration checks: npm install --no-save playwright, then npm run test:browser.
   Uses a local browser and a Spotify-shaped fixture, never a real Spotify account. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:420,height:1100},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://aura.test/**',async route=>{
  const relative=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
  await route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 await page.goto('http://aura.test/popup.html');
 await page.waitForSelector('.theme-card');
 assert.equal(await page.locator('.theme-card').count(),6);
 assert.match(await page.locator('#connection-label').textContent(),/Design preview/);
 await page.getByRole('button',{name:'Anime',exact:true}).click();
 assert.equal(await page.locator('.theme-card').count(),2);
 await page.getByRole('button',{name:'Apply Sakura dreams theme'}).click();
 assert.equal(await page.locator('#preview-name').textContent(),'Sakura dreams');
 await page.reload();await page.waitForSelector('.theme-card');
 assert.equal(await page.locator('[data-theme="sakura"]').getAttribute('aria-pressed'),'true');
 await page.getByRole('tab',{name:/Studio/}).click();
 await page.locator('#dim').fill('70');
 assert.equal(await page.locator('#dim-value').textContent(),'70%');
 await page.locator('#accent').fill('#12abcd');
 await page.locator('#background-file').setInputFiles(path.join(root,'icons/icon128.png'));
 await page.waitForFunction(()=>!document.querySelector('#remove-background').hidden);
 assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem('aura-preview')).settings.background),/^data:image\/jpeg;base64,/);
 await page.locator('#remove-background').click();
 await page.getByRole('tab',{name:/Little extras/}).click();
 await page.locator('#compact').check();
 await page.locator('#focus').check();
 await page.locator('#reduceMotion').check();
 await page.reload();await page.waitForSelector('.theme-card');
 assert.equal(await page.locator('#compact').isChecked(),true);
 assert.equal(await page.locator('#focus').isChecked(),true);
 assert.equal(await page.locator('#reduceMotion').isChecked(),true);
 await page.getByRole('tab',{name:/Studio/}).click();
 await page.locator('#reset-all').click();
 assert.equal(await page.locator('#preview-name').textContent(),'Midnight in Tokyo');
 await page.getByRole('tab',{name:/Themes/}).click();
 await page.getByRole('tab',{name:/Themes/}).focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#tab-studio').getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:/Themes/}).click();
 if(process.env.AURA_SCREENSHOT){await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'));await page.waitForTimeout(200);await page.screenshot({path:process.env.AURA_SCREENSHOT,fullPage:true});}
 console.log('PASS: popup theme filters, persistence, accent, darkness, wallpaper upload/removal, layout controls, reset, keyboard tabs.');
 // Test the actual content script, not a reimplementation, with a minimal Chrome bridge.
 const fixture=await browser.newPage();
 fixture.on('pageerror',e=>errors.push(e.message));
 await fixture.setContent(`<html><head><style>.Root{height:900px;background:rgb(0,0,0)}.Root__right-sidebar{display:block}[data-testid=tracklist-row]{height:64px}</style></head><body><div class="Root"><div class="Root__right-sidebar">Sidebar</div><div data-testid="tracklist-row">Track</div><span data-testid="context-item-link">Test song</span><span data-testid="context-item-info-subtitles">Test artist</span><button data-testid="control-button-playpause" aria-label="Pause" onclick="this.setAttribute('aria-label',this.getAttribute('aria-label')==='Pause'?'Play':'Pause');window.clicks++">Play / pause</button></div></body></html>`);
 await fixture.evaluate(()=>{
  window.clicks=0;window.listeners=[];
  window.chrome={runtime:{id:'aura-test',getURL:()=> 'data:image/svg+xml;base64,PHN2Zy8+',onMessage:{addListener:fn=>window.receive=fn}},storage:{local:{get:async()=>({settings:{theme:'sakura',focus:true,compact:true}})},onChanged:{addListener:fn=>window.listeners.push(fn)}}};
  window.update=settings=>window.listeners.forEach(fn=>fn({settings:{newValue:settings}},'local'));
  window.message=message=>new Promise(resolve=>window.receive(message,{id:'aura-test'},resolve));
 });
 await fixture.addStyleTag({path:path.join(root,'content.css')});
 await fixture.addScriptTag({path:path.join(root,'core.js')});
 await fixture.addScriptTag({path:path.join(root,'content.js')});
 await fixture.waitForFunction(()=>document.documentElement.dataset.aura==='sakura');
 assert.equal(await fixture.locator('.Root__right-sidebar').evaluate(el=>getComputedStyle(el).display),'none');
 assert.equal(await fixture.locator('[data-testid=tracklist-row]').evaluate(el=>getComputedStyle(el).height),'44px');
 assert.equal(await fixture.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--aura-accent')),'#e8a1c5');
 const status=await fixture.evaluate(()=>window.message({type:'AURA_STATUS'}));
 assert.equal(status.title,'Test song');assert.equal(status.playing,true);
 await fixture.evaluate(()=>window.message({type:'AURA_CONTROL',action:'pause'}));
 assert.equal(await fixture.evaluate(()=>window.clicks),1);
 await fixture.evaluate(()=>window.message({type:'AURA_CONTROL',action:'pause'}));
 assert.equal(await fixture.evaluate(()=>window.clicks),1,'Sleep timer must never resume a paused player');
 await fixture.evaluate(()=>window.update({enabled:false}));
 assert.equal(await fixture.locator('html').getAttribute('data-aura'),null);
 assert.equal(await fixture.locator('.Root__right-sidebar').evaluate(el=>getComputedStyle(el).display),'block');
 assert.equal(await fixture.locator('[data-testid=tracklist-row]').evaluate(el=>getComputedStyle(el).height),'64px');
 await fixture.evaluate(()=>window.update({theme:'forest',accent:'#123456',dim:70,reduceMotion:true}));
 assert.equal(await fixture.locator('html').getAttribute('data-aura'),'forest');
 assert.equal(await fixture.evaluate(()=>document.documentElement.style.getPropertyValue('--aura-shade')),'0.7');
 assert.equal(await fixture.evaluate(()=>document.documentElement.style.getPropertyValue('--aura-accent')),'#123456');
 assert.equal(await fixture.locator('html').getAttribute('data-aura-motion'),'');
 assert.deepEqual(errors,[]);
 console.log('PASS: actual content script initial load, live theme updates, compact/focus styles, disable restoration, player status, pause safety. No page errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
