/* Shared data and validation. No dependencies, network calls, or remote code. */
(function (root) {
  'use strict';
  const themes = [
    {id:'sakura', name:'Sakura dreams', category:'anime', label:'SOFT & SERENE', accent:'#e8a1c5', bg:'#201722', panel:'#2a202f', text:'#f8eef7', art:'sakura', description:'A quiet evening under pink skies.'},
    {id:'midnight', name:'Midnight in Tokyo', category:'anime', label:'AFTER HOURS', accent:'#b7a0fa', bg:'#141321', panel:'#211e32', text:'#f5f0ff', art:'midnight', description:'City lights. Headphones on. World off.'},
    {id:'forest', name:'Forest daydream', category:'aesthetic', label:'SLOW LIVING', accent:'#b3d79b', bg:'#15221e', panel:'#21332a', text:'#eff8ec', art:'forest', description:'A little room to breathe.'},
    {id:'ocean', name:'Ocean drive', category:'aesthetic', label:'COASTAL CALM', accent:'#9bdaea', bg:'#13212d', panel:'#203545', text:'#edf7ff', art:'ocean', description:'Stay a little closer to the coast.'},
    {id:'sunset', name:'Golden hour', category:'aesthetic', label:'WARM & WISTFUL', accent:'#ffbc91', bg:'#2b1d24', panel:'#3c2930', text:'#fff3eb', art:'sunset', description:'For the songs that feel like summer.'},
    {id:'mono', name:'Soft graphite', category:'minimal', label:'LESS, BUT BETTER', accent:'#d0d2dd', bg:'#17181c', panel:'#26272c', text:'#f1f1f4', art:'mono', description:'Just you and the music.'}
  ];
  const defaults = Object.freeze({enabled:true, theme:'midnight', accent:'', dim:45, compact:false, focus:false, reduceMotion:false, background:''});
  function normalize(value = {}) {
    const v = value && typeof value === 'object' ? value : {};
    const result = {...defaults};
    for (const key of ['enabled','compact','focus','reduceMotion']) if (typeof v[key] === 'boolean') result[key] = v[key];
    if (themes.some(t => t.id === v.theme)) result.theme = v.theme;
    if (typeof v.accent === 'string' && /^#[\da-f]{6}$/i.test(v.accent)) result.accent = v.accent;
    if (Number.isFinite(v.dim)) result.dim = Math.max(0,Math.min(80,Math.round(v.dim)));
    if (typeof v.background === 'string' && v.background.length <= 1500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.background)) result.background = v.background;
    return result;
  }
  function getTheme(id) { return themes.find(t => t.id === id) || themes[1]; }
  const api = {themes, defaults, normalize, getTheme};
  root.Aura = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
