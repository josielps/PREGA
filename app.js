const $ = (id) => document.getElementById(id);
const TYPES = {
  '#': ['topic', 'Tópico', 't-topic'], '@': ['verse', 'Texto Bíblico', 't-verse'], '~': ['illus', 'Ilustração', 't-illus'],
  '>': ['apply', 'Aplicação', 't-apply'], '*': ['stat', 'Estatística/Citação', 't-stat'],
};
const REF = /^((?:[1-3]\s?)?[A-Za-zÀ-ú]+(?:\s[A-Za-zÀ-ú]+)*)\s(\d+):(\d+(?:-\d+)?)$/;
let bible = {}, liveText = null, slides = null;

const SAMPLE = `# O amor de Deus
@ João 3:16
~ Um pai que espera na estrada pelo filho que partiu.
> Esta semana, procure alguém para demonstrar esse amor.
* "O amor não busca o seu próprio interesse."
# Descanso no Pastor
@ Salmos 23:1`;
$('src').value = localStorage.getItem('prega.src') ?? SAMPLE;

let room = new URLSearchParams(location.search).get('room') || localStorage.getItem('prega.room');
if (!room || !/^[A-Za-z0-9_-]{4,40}$/.test(room)) room = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
localStorage.setItem('prega.room', room);
let needsCode = false;
async function api(path, opts = {}) {
  const run = () => fetch(path, { ...opts, headers: { ...(opts.headers || {}), 'x-access-code': localStorage.getItem('prega.code') || '' } });
  let r = await run();
  if (r.status === 401 && needsCode) {
    const c = prompt('Código de acesso:');
    if (!c) return r;
    localStorage.setItem('prega.code', c);
    r = await run();
    if (r.status === 401) localStorage.removeItem('prega.code');
  }
  return r;
}
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('prega-' + room) : null;

function send(slide) {
  liveText = slide ? slide.text : null;
  bc?.postMessage({ slide });
  fetch('/api/project?room=' + room, { method: 'POST', body: JSON.stringify({ slide }) }).catch(() => {});
  render();
}

function usfm(ref) {
  const m = REF.exec(ref);
  const code = m && BOOKS[m[1].toLowerCase().replace(/^([1-3])(?=\S)/, '$1 ')];
  return code ? `${code}.${m[2]}.${m[3]}` : null;
}
const YV_IDS = { NVT: 1930 };
const passCache = JSON.parse(localStorage.getItem('prega.pass') || '{}');
function remote(ref) {
  const ver = $('version').value, id = YV_IDS[ver], u = usfm(ref);
  if (!id || !u) return null;
  const k = `${ver}|${u}`;
  if (passCache[k]) return passCache[k];
  if (passCache[k] === undefined) {
    passCache[k] = '';
    api(`/api/passage?bible=${id}&usfm=${u}`).then((r) => r.ok ? r.json() : Promise.reject()).then((j) => {
      const raw = j.content ?? j.text ?? j.data?.content ?? '';
      const t = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t) { passCache[k] = t; localStorage.setItem('prega.pass', JSON.stringify(passCache)); }
      else delete passCache[k];
      render();
    }).catch(() => { delete passCache[k]; });
  }
  return null;
}

function lookup(ref) {
  const v = bible[$('version').value] || {};
  const find = (r) => { const k = Object.keys(v).find((x) => x.toLowerCase() === r.toLowerCase()); return k ? v[k] : null; };
  const direct = find(ref);
  if (direct) return direct;
  const m = REF.exec(ref);
  if (m && m[3].includes('-')) {
    const [a, b] = m[3].split('-').map(Number), parts = [];
    for (let i = a; i <= b; i++) { const t = find(`${m[1]} ${m[2]}:${i}`); if (!t) return null; parts.push(t); }
    return parts.join(' ');
  }
  return v === bible.NVT || !Object.keys(v).length ? remote(ref) : null;
}

function parse(src) {
  return src.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = TYPES[line[0]];
    const body = m ? line.slice(1).trim() : line;
    let [type, label, cls] = m || ['text', '', 't-text'];
    if (type === 'text' && REF.test(body)) [type, label, cls] = TYPES['@'];
    if (type === 'verse') {
      const text = lookup(body);
      return { type, label, cls, ref: body, text: text || body, missing: !text };
    }
    return { type, label, cls, text: body };
  });
}

const BOOKS = { gênesis:'GEN', êxodo:'EXO', levítico:'LEV', números:'NUM', deuteronômio:'DEU', josué:'JOS', juízes:'JDG', rute:'RUT', '1 samuel':'1SA', '2 samuel':'2SA', '1 reis':'1KI', '2 reis':'2KI', '1 crônicas':'1CH', '2 crônicas':'2CH', esdras:'EZR', neemias:'NEH', ester:'EST', jó:'JOB', salmos:'PSA', provérbios:'PRO', eclesiastes:'ECC', cantares:'SNG', isaías:'ISA', jeremias:'JER', lamentações:'LAM', ezequiel:'EZK', daniel:'DAN', oseias:'HOS', joel:'JOL', amós:'AMO', obadias:'OBA', jonas:'JON', miqueias:'MIC', naum:'NAM', habacuque:'HAB', sofonias:'ZEP', ageu:'HAG', zacarias:'ZEC', malaquias:'MAL', mateus:'MAT', marcos:'MRK', lucas:'LUK', joão:'JHN', atos:'ACT', romanos:'ROM', '1 coríntios':'1CO', '2 coríntios':'2CO', gálatas:'GAL', efésios:'EPH', filipenses:'PHP', colossenses:'COL', '1 tessalonicenses':'1TH', '2 tessalonicenses':'2TH', '1 timóteo':'1TI', '2 timóteo':'2TI', tito:'TIT', filemom:'PHM', hebreus:'HEB', tiago:'JAS', '1 pedro':'1PE', '2 pedro':'2PE', '1 joão':'1JN', '2 joão':'2JN', '3 joão':'3JN', judas:'JUD', apocalipse:'REV' };
function ytLink(ref) {
  const m = REF.exec(ref);
  const code = m && BOOKS[m[1].toLowerCase().replace(/^([1-3])(?=\S)/, '$1 ')];
  return code ? `https://www.bible.com/pt/bible/1930/${code}.${m[2]}.${m[3].split('-')[0]}.NVT` : null;
}

function render() {
  const view = $('view');
  view.textContent = '';
  for (const b of parse($('src').value)) {
    const d = document.createElement('div');
    d.className = `block ${b.cls}` + (b.text === liveText ? ' live' : '');
    const c = document.createElement('div');
    c.textContent = b.text;
    if (b.ref) { const s = document.createElement('small'); s.textContent = b.ref + (b.missing ? ' (texto não encontrado na versão)' : ''); c.append(s); }
    const btn = document.createElement('button');
    btn.textContent = 'Projetar';
    btn.onclick = () => send({ type: b.type, text: b.text, ref: b.ref && !b.missing ? `${b.ref} (${$('version').value})` : '' });
    d.append(c, btn);
    const link = b.ref && ytLink(b.ref);
    if (link) { const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'NVT ↗'; a.style.color = 'inherit'; d.append(a); }
    view.append(d);
  }
  $('pulpitbar').textContent = liveText ? `Na tela: "${liveText.slice(0, 40)}${liveText.length > 40 ? '…' : ''}"` : 'Tela vazia';
}

$('src').addEventListener('input', () => { localStorage.setItem('prega.src', $('src').value); slides = null; render(); });
$('version').onchange = render;
$('clear').onclick = () => send(null);
$('openproj').onclick = () => window.open('project.html?room=' + room, 'prega-proj');
$('mode').onclick = () => {
  const on = document.body.classList.toggle('pulpit');
  $('editor').style.display = on ? 'none' : '';
  $('footer').style.display = on ? 'none' : '';
  $('main').classList.toggle('edit', !on);
  $('mode').textContent = on ? 'Modo edição' : 'Modo púlpito';
};
$('theme').onclick = () => document.body.classList.toggle('light');

// Gerador heurístico local (sem IA externa): tópicos, versículos e aplicações viram slides
function localSlides() {
  return parse($('src').value).filter((b) => ['topic', 'verse', 'apply'].includes(b.type))
    .map((b) => ({ type: b.type, text: b.text, ref: b.ref && !b.missing ? b.ref : '' }));
}
$('gen').onclick = async () => {
  const btn = $('gen'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    const r = await api('/api/ai/slides', { method: 'POST', body: JSON.stringify({ outline: $('src').value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    const out = [];
    for (const s of j.slides) {
      const type = ['topic', 'verse', 'illus', 'apply', 'stat'].includes(s.type) ? s.type : 'topic';
      if (type === 'verse') {
        const ref = String(s.ref || '').trim(), text = ref && lookup(ref);
        if (text) out.push({ type, text, ref });
      } else if (s.text && String(s.text).trim()) out.push({ type, text: String(s.text).trim(), ref: '' });
    }
    if (!out.length) throw new Error('A IA não retornou slides.');
    slides = out;
    alert(`${out.length} slides gerados pela IA. Use "Exportar PDF" ou "Exportar PowerPoint".`);
  } catch (e) {
    slides = localSlides();
    alert(`IA indisponível (${e.message}). Gerados ${slides.length} slides pelo método simples.`);
  } finally { btn.disabled = false; btn.textContent = label; }
};
$('export').onclick = () => {
  const s = slides || parse($('src').value).filter((b) => b.type !== 'text');
  const w = window.open('', '_blank');
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:landscape}body{margin:0}.s{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f1d33;color:#fff;font:40px sans-serif;text-align:center;padding:60px;box-sizing:border-box;page-break-after:always}.r{font-size:24px;opacity:.8;margin-top:30px}</style>` +
    s.map((x) => `<div class="s">${esc(x.text)}<div class="r">${esc(x.ref)}</div></div>`).join(''));
  w.document.close(); w.print();
};

$('exportpptx').onclick = () => {
  if (typeof PptxGenJS === 'undefined') return alert('Biblioteca PowerPoint indisponível (offline).');
  const s = slides || parse($('src').value).filter((b) => b.type !== 'text');
  const p = new PptxGenJS();
  p.layout = 'LAYOUT_WIDE';
  for (const x of s) {
    const sl = p.addSlide();
    sl.background = { color: '0F1D33' };
    sl.addText(x.text, { x: 0.7, y: 0.8, w: 11.9, h: 4.8, align: 'center', valign: 'middle', fontSize: 36, color: 'FFFFFF' });
    if (x.ref) sl.addText(x.ref, { x: 0.7, y: 5.8, w: 11.9, h: 0.8, align: 'center', fontSize: 20, color: 'CCCCCC' });
  }
  p.writeFile({ fileName: 'pregacao.pptx' });
};

let secs = 0, tick = null;
function drawTimer() {
  const limit = $('tmin').value * 60, t = $('timer');
  t.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  t.className = secs >= limit ? 'over' : secs >= limit - 300 ? 'warn' : '';
}
$('tstart').onclick = () => { if (tick) { clearInterval(tick); tick = null; } else tick = setInterval(() => { secs++; drawTimer(); }, 1000); };
$('treset').onclick = () => { secs = 0; drawTimer(); };
$('tmin').oninput = drawTimer;

fetch('/api/info').then((r) => r.json()).then((i) => {
  needsCode = !!i.needsCode;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const base = local && i.urls[0] ? i.urls[0] : location.origin;
  const link = `${base}/project.html?room=${room}`;
  $('net').textContent = 'Projeção em outro dispositivo: ' + link;
  $('qr').innerHTML = `<img width="120" alt="QR" src="/api/qr?text=${encodeURIComponent(link)}">`;
}).catch(() => {});
let hasKey = false;
function loadVersions(b) {
  delete b._nota;
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem('prega.bible') || '{}'); } catch {}
  bible = { ...(hasKey ? { NVT: {} } : {}), ...b, ...custom };
  const prev = $('version').value;
  $('version').innerHTML = Object.keys(bible).map((v) => `<option>${v}</option>`).join('');
  $('version').value = bible[prev] ? prev : Object.keys(bible)[0];
  render();
}
let baseBible = {};
Promise.all([
  fetch('/api/info').then((r) => r.json()).catch(() => ({})),
  fetch('bible.json').then((r) => r.json()),
]).then(([info, b]) => { hasKey = !!info.yvp; baseBible = b; loadVersions({ ...b }); });

$('import').onclick = () => $('importfile').click();
$('importfile').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const ok = Object.values(data).every((v) => v && typeof v === 'object' && Object.values(v).every((t) => typeof t === 'string'));
    if (!ok || !Object.keys(data).length) throw new Error();
    const cur = JSON.parse(localStorage.getItem('prega.bible') || '{}');
    localStorage.setItem('prega.bible', JSON.stringify({ ...cur, ...data }));
    loadVersions({ ...baseBible });
    alert('Versões importadas: ' + Object.keys(data).join(', '));
  } catch { alert('Arquivo inválido. Formato: {"NVT":{"João 3:16":"texto..."}}'); }
  e.target.value = '';
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
drawTimer();
