(() => {
const engine=window.PostDestroyer;
function render(){const s=engine.getState();document.querySelectorAll('[data-weapon]').forEach(b=>{b.classList.toggle('selected',b.dataset.weapon===s.weapon);b.setAttribute('aria-pressed',b.dataset.weapon===s.weapon);});const sound=document.getElementById('sound');sound.classList.toggle('on',s.sound);sound.setAttribute('aria-pressed',s.sound);document.getElementById('count').textContent=String(s.count).padStart(2,'0');document.getElementById('reset').disabled=s.busy;}
document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>engine.configure({weapon:b.dataset.weapon}));document.getElementById('sound').onclick=()=>engine.configure({sound:!engine.getState().sound});document.getElementById('reset').onclick=()=>engine.reset();document.addEventListener('tpd:change',render);render();
})();
