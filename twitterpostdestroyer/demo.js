(() => {
  'use strict';
  const engine = window.PostDestroyer;
  const weapons = [...document.querySelectorAll('[data-weapon]')];
  const sound = document.getElementById('sound');
  const count = document.getElementById('count');
  const reset = document.getElementById('reset');
  function render() {
    const state = engine.getState();
    for (const button of weapons) {
      const selected = button.dataset.weapon === state.weapon;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected);
    }
    sound.classList.toggle('on', state.sound);
    sound.setAttribute('aria-pressed', state.sound);
    count.textContent = String(state.count).padStart(2, '0');
    reset.disabled = state.busy;
  }
  weapons.forEach(button => { button.onclick = () => engine.configure({ weapon: button.dataset.weapon }); });
  sound.onclick = () => engine.configure({ sound: !engine.getState().sound });
  reset.onclick = () => engine.reset();
  document.addEventListener('tpd:change', render);
  render();
})();
