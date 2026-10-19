/* Shared data and validation. No dependencies, network calls, or remote code. */
(function (root) {
  'use strict';
  const themes = [
    {id:'violet-muse', name:'Violet muse', category:'anime', tags:['waifu'], label:'ANIME GIRL · LO-FI', accent:'#d4b3f4', bg:'#1a1426', panel:'#2c213d', text:'#f8f0ff', art:'violet-muse', format:'webp', description:'Her favorite song. Your quiet little world.'},
    {id:'moonlight-waifu', name:'Moonlight waifu', category:'anime', tags:['waifu'], label:'WAIFU · MOONLIT CALM', accent:'#a5e2e9', bg:'#101b2c', panel:'#1d3046', text:'#edf9ff', art:'moonlight-waifu', format:'webp', description:'Silver hair, ocean air, one more song.'},
    {id:'sakura', name:'Sakura dreams', category:'anime', label:'SOFT & SERENE', accent:'#e8a1c5', bg:'#201722', panel:'#2a202f', text:'#f8eef7', art:'sakura', description:'A quiet evening under pink skies.'},
    {id:'midnight', name:'Midnight in Tokyo', category:'anime', label:'AFTER HOURS', accent:'#b7a0fa', bg:'#141321', panel:'#211e32', text:'#f5f0ff', art:'midnight', description:'City lights. Headphones on. World off.'},
    {id:'forest', name:'Forest daydream', category:'aesthetic', label:'SLOW LIVING', accent:'#b3d79b', bg:'#15221e', panel:'#21332a', text:'#eff8ec', art:'forest', description:'A little room to breathe.'},
    {id:'ocean', name:'Ocean drive', category:'aesthetic', label:'COASTAL CALM', accent:'#9bdaea', bg:'#13212d', panel:'#203545', text:'#edf7ff', art:'ocean', description:'Stay a little closer to the coast.'},
    {id:'sunset', name:'Golden hour', category:'aesthetic', label:'WARM & WISTFUL', accent:'#ffbc91', bg:'#2b1d24', panel:'#3c2930', text:'#fff3eb', art:'sunset', description:'For the songs that feel like summer.'},
    {id:'mono', name:'Soft graphite', category:'minimal', label:'LESS, BUT BETTER', accent:'#d0d2dd', bg:'#17181c', panel:'#26272c', text:'#f1f1f4', art:'mono', description:'Just you and the music.'},
    {id:'cyberpunk', name:'Neon afterglow', category:'aesthetic', label:'CYBERPUNK · 2 AM', accent:'#f59cdb', bg:'#180f27', panel:'#2b1c40', text:'#fcf0ff', art:'cyberpunk', description:'A neon-lit soundtrack to the late hours.'},
    {id:'stargazer', name:'Stargazer', category:'aesthetic', label:'COSMIC · DEEP FOCUS', accent:'#afaef5', bg:'#11152b', panel:'#202641', text:'#f2f1ff', art:'stargazer', description:'Get lost somewhere between the stars.'},
    {id:'matcha', name:'Matcha morning', category:'aesthetic', label:'COZY · SLOW MORNINGS', accent:'#c6d6a4', bg:'#1d241b', panel:'#303b29', text:'#f5f8ea', art:'matcha', description:'A warm cup and a softer kind of morning.'},
    {id:'rose', name:'Rose quartz', category:'minimal', label:'BLUSH · SOFT MINIMAL', accent:'#e9bbcd', bg:'#251b24', panel:'#392b37', text:'#fff1f6', art:'rose', description:'A softer shade of your everyday soundtrack.'}
  ];
  const fonts = [
    {id:'default', name:'Spotify original', note:'The familiar favorite', family:'', sample:'Aa'},
    {id:'modern', name:'Clean modern', note:'Crisp & effortless', family:'system-ui, -apple-system, "Segoe UI", sans-serif', sample:'Aa'},
    {id:'rounded', name:'Soft rounded', note:'A little more playful', family:'"Arial Rounded MT Bold", "Nunito", ui-rounded, "Trebuchet MS", sans-serif', sample:'Aa'},
    {id:'serif', name:'Editorial', note:'For your album era', family:'Georgia, "Times New Roman", serif', sample:'Aa'},
    {id:'mono', name:'Terminal', note:'A retro digital feeling', family:'ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace', sample:'Aa'},
    {id:'bookish', name:'Bookish', note:'Warm & unhurried', family:'"Palatino Linotype", "Book Antiqua", Palatino, "DejaVu Serif", serif', sample:'Aa'}
  ];
  const defaults = Object.freeze({enabled:true, theme:'midnight', accent:'', dim:45, compact:false, focus:false, reduceMotion:false, background:'', font:'default'});
  function normalize(value = {}) {
    const v = value && typeof value === 'object' ? value : {};
    const result = {...defaults};
    for (const key of ['enabled','compact','focus','reduceMotion']) if (typeof v[key] === 'boolean') result[key] = v[key];
    if (themes.some(t => t.id === v.theme)) result.theme = v.theme;
    if (fonts.some(f => f.id === v.font)) result.font = v.font;
    if (typeof v.accent === 'string' && /^#[\da-f]{6}$/i.test(v.accent)) result.accent = v.accent;
    if (Number.isFinite(v.dim)) result.dim = Math.max(0,Math.min(80,Math.round(v.dim)));
    if (typeof v.background === 'string' && v.background.length <= 1500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.background)) result.background = v.background;
    return result;
  }
  function getTheme(id) { return themes.find(t => t.id === id) || themes.find(t => t.id === defaults.theme); }
  function getFont(id) { return fonts.find(f => f.id === id) || fonts[0]; }
  function artwork(theme) { return `assets/${theme.art}.${theme.format || 'svg'}`; }
  function thumbnail(theme) { return theme.format === 'webp' ? `assets/${theme.art}-thumb.webp` : artwork(theme); }
  function matchesTheme(theme,filter,query='') {
    return (filter === 'all' || theme.category === filter || (theme.tags || []).includes(filter))
      && `${theme.name} ${theme.category} ${theme.label} ${theme.description}`.toLowerCase().includes(query.trim().toLowerCase());
  }
  const api = {themes, fonts, defaults, normalize, getTheme, getFont, artwork, thumbnail, matchesTheme};
  root.Aura = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
