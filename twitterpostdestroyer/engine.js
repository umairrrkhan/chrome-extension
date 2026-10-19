(() => {
  'use strict';
  if (window.PostDestroyer) return;

  const defaults = { enabled: true, weapon: 'rpg', sound: false };
  const selector = document.querySelector('[data-demo-post]')
    ? '[data-demo-post]' : 'article[data-testid="tweet"]';
  const weapons = ['rpg', 'hammer', 'laser'];
  const names = { rpg: 'Rocket', hammer: 'Hammer', laser: 'Laser' };
  const maxUndo = 30;
  const lifetime = new AbortController();
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const storage = typeof chrome !== 'undefined' ? chrome.storage : null;
  const history = [];
  let settings = { ...defaults };
  let disposed = false;
  let frame = 0;
  let layoutFrame = 0;
  let lastTime = 0;
  let hiddenAt = 0;
  let hovered = null;
  let scene = null;
  let particles = [];
  let returning = false;
  let audio = null;
  let toastTimer = 0;
  let w = innerWidth;
  let h = innerHeight;
  let bounds = null;
  let man = { x: 64, y: h - 12, dir: 1, mode: 'idle' };

  const host = document.createElement('div');
  host.id = 'tpd-world';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  // All styles stay inside the shadow root; the feed keeps its own styling.
  root.innerHTML = `
    <style>
      :host { all:initial; }
      * { box-sizing:border-box; }
      [hidden] { display:none !important; }
      button { font:12px/1.3 Arial,sans-serif; cursor:pointer; color:#eee; }
      button:focus-visible { outline:2px solid #ff885c; outline-offset:3px; }
      button:disabled { opacity:.35; cursor:default; }
      canvas { position:fixed; pointer-events:none; }
      canvas.resting { animation:breathe 3.6s ease-in-out infinite; }
      @keyframes breathe { 50% { transform:translateY(-1.5px); } }
      .dock { position:fixed; right:20px; bottom:20px; z-index:3; pointer-events:auto;
        display:flex; align-items:center; gap:3px; padding:5px; background:#1d1f21;
        border:1px solid #393c3f; border-radius:12px; box-shadow:0 4px 16px #0003; }
      .dock button { border:0; background:transparent; padding:9px 10px; border-radius:7px; }
      .dock button:hover { background:#ffffff0d; }
      #menu { display:flex; align-items:center; gap:8px; }
      .mark { color:#ff8154; display:inline-flex; }
      .mark svg { width:17px; height:17px; }
      .status { font-size:11px; color:#b6b8ba; }
      .separator { width:1px; height:17px; background:#3b3d40; }
      .options { position:absolute; bottom:calc(100% + 8px); right:0; width:220px;
        background:#1d1f21; border:1px solid #393c3f; border-radius:12px; padding:8px;
        box-shadow:0 8px 24px #0003; }
      .options .caption { padding:8px; font:10px Arial; color:#92989d; letter-spacing:1px; }
      .options button { width:100%; display:flex; align-items:center; justify-content:space-between;
        padding:10px; text-align:left; }
      .options button.active { color:#ff996f; background:#ff815410; }
      .shortcut { color:#858b90; font-size:10px; }
      .settings { border-top:1px solid #34373a; margin-top:5px; padding-top:5px; }
      .target { position:fixed; z-index:2; pointer-events:auto; display:flex; align-items:center;
        gap:6px; color:#f1efea; background:#252729; border:1px solid #ff81548c;
        box-shadow:0 2px 8px #0002; border-radius:7px; padding:7px 9px; }
      .target svg { color:#ff996f; width:14px; height:14px; }
      .target:hover { background:#34302b; border-color:#ff996f; }
      .toast { position:fixed; right:20px; bottom:80px; max-width:280px; padding:11px 15px;
        background:#252729; border:1px solid #45494d; border-radius:9px;
        color:#e1e3e4; font:12px/1.5 Arial,sans-serif; }
      @media(max-width:600px) { .dock { right:12px; bottom:12px; } .toast { right:12px; } }
      @media(prefers-reduced-motion:reduce) { canvas.resting { animation:none; } }
    </style>
    <canvas aria-hidden="true"></canvas>
    <button class="target" aria-label="Destroy this post locally" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="6"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/>
      </svg>Destroy
    </button>
    <div class="toast" role="status" hidden></div>
    <div class="dock" role="toolbar" aria-label="Post destroyer controls">
      <button id="menu" aria-expanded="false" aria-controls="options" title="Choose weapon and settings">
        <span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><path d="m12 8-1 7m0-5-5 3m5-3 5 3m-5 2-4 6m4-6 5 6"/></svg></span>
        <span class="status">Rocket</span><span aria-hidden="true">⌃</span>
      </button>
      <span class="separator"></span>
      <button id="undo" disabled title="Restore last hidden post">Undo</button>
      <div class="options" id="options" hidden>
        <div class="caption">CHOOSE A TOOL</div>
        <button data-w="rpg">Rocket launcher <span class="shortcut">1</span></button>
        <button data-w="hammer">Hammer <span class="shortcut">2</span></button>
        <button data-w="laser">Laser <span class="shortcut">3</span></button>
        <div class="settings">
          <button id="audio">Sound <span class="shortcut">Off</span></button>
          <button id="pause">Pause extension</button>
        </div>
      </div>
    </div>`;
  document.documentElement.append(host);
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const target = root.querySelector('.target');
  const menu = root.querySelector('#menu');
  const options = root.querySelector('#options');
  const status = root.querySelector('.status');
  const undoButton = root.querySelector('#undo');
  const audioButton = root.querySelector('#audio');
  const pauseButton = root.querySelector('#pause');
  const weaponButtons = [...root.querySelectorAll('[data-w]')];

  function listen(object, event, handler, options = {}) {
    object.addEventListener(event, handler, { ...options, signal: lifetime.signal });
  }

  function emit() {
    if (disposed) return;
    document.dispatchEvent(new CustomEvent('tpd:change', { detail: getState() }));
  }

  function getState() {
    return { ...settings, count: history.length, busy: !!scene };
  }

  function update() {
    weaponButtons.forEach(button => {
      const selected = button.dataset.w === settings.weapon;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected);
    });
    status.textContent = scene ? 'On the way…' : settings.enabled ? names[settings.weapon] : 'Paused';
    audioButton.querySelector('span').textContent = settings.sound ? 'On' : 'Off';
    audioButton.setAttribute('aria-pressed', settings.sound);
    pauseButton.textContent = settings.enabled ? 'Pause extension' : 'Resume extension';
    undoButton.disabled = !history.length;
    emit();
  }

  function configure(patch, persist = true) {
    if (disposed) return;
    const next = { ...settings };
    for (const key of ['enabled', 'sound']) {
      if (typeof patch[key] === 'boolean') next[key] = patch[key];
    }
    if (weapons.includes(patch.weapon)) next.weapon = patch.weapon;
    const changed = Object.keys(defaults).some(key => next[key] !== settings[key]);
    settings = next;
    if (!settings.enabled && (scene || returning || particles.length)) cancelAttack();
    if (!settings.sound) audio?.suspend().catch(() => {});
    update();
    scheduleLayout();
    if (!scene && !returning && !particles.length) rest();
    if (changed && persist && storage?.local) storage.local.set(settings).catch(() => {});
  }

  function toggleMenu(open = options.hidden) {
    options.hidden = !open;
    menu.setAttribute('aria-expanded', open);
  }

  function toast(message) {
    const element = root.querySelector('.toast');
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.hidden = true; }, 2200);
  }

  function sound(type) {
    if (!settings.sound || disposed) return;
    try {
      audio ??= new AudioContext();
      audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.type = type === 'laser' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(type === 'laser' ? 880 : type === 'hammer' ? 160 : 90, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(30, audio.currentTime + 0.3);
      gain.gain.setValueAtTime(0.065, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.36);
    } catch { /* Audio availability must never interrupt the animation. */ }
  }

  // One shared target, discovered on interaction. No feed-wide scans or observers.
  function selectPost(post) {
    if (hovered === post) return;
    hovered = post;
    scheduleLayout();
  }

  function scheduleLayout() {
    if (disposed || document.hidden || layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      positionTarget();
    });
  }

  function positionTarget() {
    if (disposed) return;
    if (scene && !scene.impact && scene.post.isConnected) scene.rect = scene.post.getBoundingClientRect();
    if (!hovered?.isConnected || !settings.enabled || scene || hovered.hasAttribute('data-tpd-hidden')) {
      target.hidden = true;
      if (!hovered?.isConnected) hovered = null;
      return;
    }
    const rect = hovered.getBoundingClientRect();
    if (rect.bottom < 40 || rect.top > h - 50 || rect.right < 0 || rect.left > w) {
      target.hidden = true;
      return;
    }
    target.style.left = `${Math.max(8, Math.min(w - 104, rect.right - 105))}px`;
    target.style.top = `${Math.max(8, Math.min(h - 50, rect.top + 12))}px`;
    target.hidden = false;
  }

  function identity(post) {
    const link = post.querySelector('time')?.closest('a[href]') || post.querySelector('a[href*="/status/"]');
    return link?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] || null;
  }

  function prune() {
    for (const record of [...history]) {
      if (!record.post.isConnected || identity(record.post) !== record.identity) restore(record, false);
    }
  }

  // Allocate a viewport canvas only while something is actually moving.
  function setCanvas(full) {
    const next = full ? { x: 0, y: 0, width: w, height: h }
      : { x: 20, y: Math.max(0, h - 103), width: 100, height: 96 };
    const scale = full ? Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2400000 / (w * h)))
      : Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(next.width * scale));
    const pixelHeight = Math.max(1, Math.round(next.height * scale));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    bounds = next;
    Object.assign(canvas.style, { left: `${next.x}px`, top: `${next.y}px`, width: `${next.width}px`, height: `${next.height}px` });
    ctx.setTransform(scale, 0, 0, scale, -next.x * scale, -next.y * scale);
    canvas.classList.toggle('resting', !full && !motionQuery.matches);
  }

  function clearCanvas() { ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height); }

  function rest() {
    if (disposed) return;
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    man = { x: 64, y: h - 12, dir: 1, mode: 'idle' };
    setCanvas(false);
    clearCanvas();
    canvas.hidden = !settings.enabled || document.hidden;
    if (!canvas.hidden) drawMan(0);
  }

  function requestTick() {
    if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function attack(post) {
    if (disposed || scene || !settings.enabled || !post?.isConnected || post.hasAttribute('data-tpd-hidden')) return;
    const rect = post.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > h) return;
    prune();
    returning = false;
    scene = { post, identity: identity(post), rect, weapon: settings.weapon, start: performance.now(),
      from: { x: man.x, y: man.y }, x: 0, y: 0, impact: false };
    target.hidden = true;
    toggleMenu(false);
    update();
    if (motionQuery.matches) {
      impact();
      finish();
      rest();
    } else {
      canvas.hidden = false;
      setCanvas(true);
      lastTime = 0;
      requestTick();
    }
  }

  function burst(x, y, weapon) {
    const colors = weapon === 'laser' ? ['#b9f6ec', '#65e4cc', '#ffffff']
      : ['#ff8154', '#ffc080', '#ece7d5', '#747577'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 230;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70,
        life: 0.4 + Math.random() * 0.55, size: 2 + Math.random() * 5, color: colors[i % colors.length] });
    }
  }

  function impact() {
    if (!scene || scene.impact) return;
    scene.impact = true;
    const post = scene.post;
    if (!post.isConnected || identity(post) !== scene.identity) return;
    while (history.length >= maxUndo) restore(history[0], false);
    const rect = scene.rect;
    if (!motionQuery.matches) burst(rect.left + rect.width * 0.52, Math.max(20, Math.min(h - 30, rect.top + rect.height * 0.45)), scene.weapon);
    sound(scene.weapon);
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-tpd-placeholder', '');
    placeholder.style.cssText = 'padding:10px 16px;border-bottom:1px solid #8882;color:#969ba0;font:12px/1.4 Arial,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:12px;';
    const label = document.createElement('span');
    label.textContent = 'Post hidden';
    const undo = document.createElement('button');
    undo.textContent = 'Undo';
    undo.style.cssText = 'border:0;background:transparent;color:#d79576;padding:4px 8px;font:12px Arial;cursor:pointer;';
    placeholder.append(label, undo);
    const record = { post, placeholder, identity: scene.identity, animation: null, didHide: false,
      display: post.style.getPropertyValue('display'), priority: post.style.getPropertyPriority('display') };
    history.push(record);
    undo.onclick = () => restore(record);
    post.setAttribute('data-tpd-hidden', '');
    const hide = () => {
      if (!history.includes(record)) return;
      if (!post.isConnected || identity(post) !== record.identity) { restore(record); return; }
      if (!placeholder.isConnected) post.before(placeholder);
      placeholder.hidden = false;
      record.display = post.style.getPropertyValue('display');
      record.priority = post.style.getPropertyPriority('display');
      record.didHide = true;
      post.style.setProperty('display', 'none', 'important');
      record.animation?.cancel();
      record.animation = null;
      scheduleLayout();
    };
    // This observer watches only a hidden post, so recycled X nodes are restored.
    record.observer = new MutationObserver(() => {
      if (identity(post) !== record.identity) restore(record);
    });
    record.observer.observe(post, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    if (motionQuery.matches) hide();
    else {
      const squash = scene.weapon === 'hammer';
      record.animation = post.animate([
        { opacity: 1, transform: 'none' },
        { opacity: 0.8, transform: squash ? 'scale(1.01,.82)' : 'translateY(-3px) rotate(1deg)' },
        { opacity: 0, transform: scene.weapon === 'laser' ? 'scale(1,.02)' : 'translateY(16px) scale(.96)' }
      ], { duration: 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      record.animation.finished.then(hide).catch(() => {});
    }
    update();
  }

  function restore(record, notify = true) {
    const index = history.indexOf(record);
    if (index < 0) return;
    history.splice(index, 1);
    record.observer.disconnect();
    record.animation?.cancel();
    // Restore only the display value that we set; later site changes take precedence.
    if (record.didHide && record.post.style.display === 'none' && record.post.style.getPropertyPriority('display') === 'important') {
      if (record.display) record.post.style.setProperty('display', record.display, record.priority);
      else record.post.style.removeProperty('display');
    }
    record.post.removeAttribute('data-tpd-hidden');
    record.placeholder.remove();
    if (notify && !disposed) { update(); scheduleLayout(); }
  }

  function undo() {
    if (disposed) return;
    prune();
    const record = history.at(-1);
    if (record) restore(record);
    else update();
  }

  function reset() {
    if (disposed) return;
    if (scene) { toast('Let him finish this one first.'); return; }
    [...history].reverse().forEach(record => restore(record, false));
    particles = [];
    returning = false;
    rest();
    update();
    scheduleLayout();
    toast('Feed restored.');
  }

  function finish() {
    scene = null;
    returning = !motionQuery.matches;
    man.mode = 'idle';
    update();
    scheduleLayout();
  }

  function cancelAttack() {
    scene = null;
    returning = false;
    particles = [];
    rest();
  }

  function line(points, color = '#f1eee5', width = 4) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  }

  function drawMan(t) {
    ctx.save();
    ctx.translate(man.x, man.y);
    ctx.scale(man.dir, 1);
    const walk = man.mode === 'walk';
    const climb = man.mode === 'climb';
    const attacking = man.mode === 'attack';
    const wave = Math.sin(t * 0.016);
    ctx.translate(0, walk ? -Math.abs(wave) * 3 : 0);
    ctx.strokeStyle = '#f0eee5';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#202123';
    ctx.beginPath();
    ctx.arc(0, -61, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    line([[0, -50], [-2, -28]]);
    if (climb) {
      line([[0, -44], [-12, -52 + wave * 8], [-18, -68 + wave * 8]]);
      line([[0, -44], [14, -47 - wave * 9], [20, -65 - wave * 9]]);
      line([[-2, -28], [-13, -13 + wave * 8], [-16, 0]]);
      line([[-2, -28], [12, -15 - wave * 8], [18, -5]]);
    } else {
      line([[-2, -28], [-10 - (walk ? wave * 9 : 0), -14], [walk ? -wave * 18 : -13, 0]]);
      line([[-2, -28], [9 + (walk ? wave * 9 : 0), -14], [walk ? wave * 18 : 14, 0]]);
      if (attacking) {
        line([[0, -45], [13, -39], [29, -48]]);
        line([[0, -45], [-10, -36], [18, -42]]);
      } else {
        line([[0, -44], [walk ? wave * 13 : -12, -29], [walk ? wave * 18 : -15, -23]]);
        line([[0, -44], [walk ? -wave * 13 : 10, -30], [walk ? -wave * 18 : 15, -23]]);
      }
    }
    ctx.fillStyle = '#ff8154';
    ctx.fillRect(1, -64, 4, 3);
    if (attacking && scene) {
      if (scene.weapon === 'rpg') {
        ctx.save();
        ctx.translate(14, -49);
        ctx.rotate(-0.13);
        ctx.fillStyle = '#92987c';
        ctx.fillRect(0, -5, 37, 9);
        ctx.fillStyle = '#c1c6a3';
        ctx.beginPath();
        ctx.moveTo(34, -9); ctx.lineTo(48, 0); ctx.lineTo(34, 8); ctx.fill();
        ctx.fillStyle = '#686e55';
        ctx.fillRect(12, 4, 6, 10);
        ctx.restore();
      } else if (scene.weapon === 'hammer') {
        ctx.save();
        ctx.translate(17, -45);
        ctx.rotate(Math.sin(Math.min((t - scene.start - 1200) / 400, 1) * Math.PI) * 2 - 1.5);
        line([[0, 0], [0, -43]], '#a27c55', 6);
        ctx.fillStyle = '#9e9fa4';
        ctx.fillRect(-17, -51, 34, 19);
        ctx.restore();
      } else {
        line([[15, -46], [37, -46]], '#727e81', 9);
        ctx.fillStyle = '#75ead2';
        ctx.fillRect(33, -50, 8, 8);
      }
    }
    ctx.restore();
  }

  function animateScene(t) {
    if (!scene.post.isConnected) { finish(); return; }
    const elapsed = t - scene.start;
    const rect = scene.rect;
    scene.x = Math.max(58, Math.min(w - 58, rect.left + 35));
    scene.y = Math.max(110, Math.min(h - 80, rect.top + 90));
    man.dir = 1;
    if (elapsed < 650) {
      const progress = elapsed / 650;
      man.x = scene.from.x + (scene.x - scene.from.x) * progress;
      man.y = scene.from.y;
      man.dir = scene.x >= scene.from.x ? 1 : -1;
      man.mode = 'walk';
    } else if (elapsed < 1250) {
      const progress = (elapsed - 650) / 600;
      const eased = progress * progress * (3 - 2 * progress);
      man.x = scene.x;
      man.y = scene.from.y + (scene.y - scene.from.y) * eased;
      man.mode = 'climb';
    } else {
      man.x = scene.x;
      man.y = scene.y;
      man.mode = 'attack';
      if (elapsed > 1700 && !scene.impact) impact();
      if (elapsed > 2250) { finish(); return; }
    }
    if (elapsed > 1450 && elapsed < 1730) {
      const x = rect.left + rect.width * 0.52;
      const y = Math.max(20, Math.min(h - 30, rect.top + rect.height * 0.45));
      if (scene.weapon === 'rpg') {
        const progress = Math.min(1, (elapsed - 1450) / 250);
        const tail = Math.max(0, progress - 0.16);
        const sx = man.x + 40, sy = man.y - 47;
        line([[sx + (x - sx) * tail, sy + (y - sy) * tail], [sx + (x - sx) * progress, sy + (y - sy) * progress]], '#ffb25c', 6);
      } else if (scene.weapon === 'laser') {
        line([[man.x + 35, man.y - 46], [x, y]], '#8cffe0', 3);
      }
    }
  }

  function tick(t) {
    frame = 0;
    if (disposed || document.hidden) return;
    const dt = Math.min((t - (lastTime || t)) / 1000, 0.04);
    lastTime = t;
    clearCanvas();
    if (scene) animateScene(t);
    if (!scene && returning) {
      const blend = 1 - Math.exp(-dt * 14);
      man.x += (64 - man.x) * blend;
      man.y += (h - 12 - man.y) * blend;
      man.dir = man.x > 64 ? -1 : 1;
      man.mode = 'walk';
      if (Math.abs(man.x - 64) < 2 && Math.abs(man.y - (h - 12)) < 2) returning = false;
    }
    if (settings.enabled) drawMan(t);
    let alive = 0;
    for (const particle of particles) {
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.vy += 360 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      ctx.globalAlpha = Math.min(1, particle.life * 2);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size * 0.7);
      particles[alive++] = particle;
    }
    particles.length = alive;
    ctx.globalAlpha = 1;
    if (scene || particles.length || returning) requestTick();
    else rest();
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local') return;
    const patch = {};
    for (const key of Object.keys(defaults)) {
      if (changes[key]) patch[key] = changes[key].newValue ?? defaults[key];
    }
    if (Object.keys(patch).length) configure(patch, false);
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(layoutFrame);
    clearTimeout(toastTimer);
    storage?.onChanged?.removeListener(onStorageChanged);
    [...history].forEach(record => restore(record, false));
    scene = null;
    hovered = null;
    particles = [];
    audio?.close().catch(() => {});
    host.remove();
    delete window.PostDestroyer;
  }

  target.onclick = () => attack(hovered);
  menu.onclick = () => toggleMenu();
  undoButton.onclick = undo;
  weaponButtons.forEach(button => {
    button.onclick = () => { configure({ weapon: button.dataset.w }); toggleMenu(false); menu.focus(); };
  });
  audioButton.onclick = () => { configure({ sound: !settings.sound }); if (settings.sound) sound('laser'); };
  pauseButton.onclick = () => { configure({ enabled: !settings.enabled }); toggleMenu(false); menu.focus(); };

  function onPointer(event) {
    if (event.composedPath().includes(target)) return;
    selectPost(event.target.closest?.(selector) || null);
  }
  listen(document, 'pointerover', onPointer, { passive: true });
  listen(document, 'pointermove', onPointer, { passive: true });
  listen(document, 'pointerout', event => { if (!event.relatedTarget) selectPost(null); }, { passive: true });
  listen(document, 'focusin', event => {
    if (event.target === host) return;
    selectPost(event.target.closest?.(selector) || null);
  });
  listen(document, 'pointerdown', event => { if (!event.composedPath().includes(host)) toggleMenu(false); }, { passive: true });
  listen(document, 'keydown', event => {
    if (event.key === 'Escape') { toggleMenu(false); return; }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
    const weapon = { '1': 'rpg', '2': 'hammer', '3': 'laser' }[event.key];
    if (weapon && settings.enabled) configure({ weapon });
  });
  listen(window, 'scroll', () => { if (hovered || scene) scheduleLayout(); }, { passive: true, capture: true });
  listen(window, 'resize', () => {
    w = innerWidth; h = innerHeight;
    if (scene || returning || particles.length) setCanvas(true);
    else rest();
    scheduleLayout();
  }, { passive: true });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(frame); frame = 0;
      cancelAnimationFrame(layoutFrame); layoutFrame = 0;
      canvas.hidden = true;
      target.hidden = true;
      for (const record of history) record.animation?.pause();
      audio?.suspend().catch(() => {});
    } else {
      if (scene && hiddenAt) scene.start += performance.now() - hiddenAt;
      hiddenAt = 0;
      lastTime = 0;
      prune();
      update();
      for (const record of history) record.animation?.play();
      if (scene || particles.length || returning) { canvas.hidden = false; requestTick(); }
      else rest();
      scheduleLayout();
    }
  });
  listen(motionQuery, 'change', () => {
    if (motionQuery.matches) {
      if (scene) { impact(); finish(); }
      particles = []; returning = false;
      for (const record of history) record.animation?.finish();
      rest();
    } else if (!scene) rest();
  });
  listen(window, 'pagehide', event => { if (!event.persisted) destroy(); });

  window.PostDestroyer = { configure, reset, undo, getState, destroy };
  if (storage?.local) {
    storage.local.get(defaults).then(saved => configure(saved, false)).catch(() => {});
    storage.onChanged?.addListener(onStorageChanged);
  }
  update();
  rest();
})();
