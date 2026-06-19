// script.js - Pulso do Brasil frontend (accessibility, feedback, atlas graphs)
// Uses window.SUPABASE_URL and window.SUPABASE_ANON_KEY from index.html

const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase URL/ANON key não configurados. Cole-os no topo do index.html');
}

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const buttons = document.querySelectorAll('#emotionButtons button');
const liveCountsEl = $('liveCounts');
const liveParticipantsEl = $('liveParticipants');
const atlasListEl = $('atlasList');
const srAnnounce = $('srAnnounce');

const EMOTIONS = ['amor','esperanca','paz','raiva','ansiedade','tristeza','solidao','gratidao'];
const EMO_COLORS = {
  amor: getComputedStyle(document.documentElement).getPropertyValue('--emotion-amor').trim() || '#ff2d55',
  esperanca: getComputedStyle(document.documentElement).getPropertyValue('--emotion-esperanca').trim() || '#ffc23d',
  paz: getComputedStyle(document.documentElement).getPropertyValue('--emotion-paz').trim() || '#2ee6c8',
  raiva: getComputedStyle(document.documentElement).getPropertyValue('--emotion-raiva').trim() || '#ff3b1f',
  ansiedade: getComputedStyle(document.documentElement).getPropertyValue('--emotion-ansiedade').trim() || '#b14dff',
  tristeza: getComputedStyle(document.documentElement).getPropertyValue('--emotion-tristeza').trim() || '#2f6bff',
  solidao: getComputedStyle(document.documentElement).getPropertyValue('--emotion-solidao').trim() || '#8a93a8',
  gratidao: getComputedStyle(document.documentElement).getPropertyValue('--emotion-gratidao').trim() || '#3ddb6a'
};

// Attach handlers and accessibility improvements
buttons.forEach(btn => {
  // ensure accessible name
  btn.setAttribute('role','button');
  btn.setAttribute('aria-pressed','false');

  // keyboard: Space also triggers a click for some browsers; keep for completeness
  btn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      btn.click();
    }
  });

  btn.addEventListener('click', async () => {
    const emotion = btn.dataset.emotion;
    // visual feedback
    btn.classList.add('animating');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Registrando...';
    btn.setAttribute('aria-pressed','true');

    try {
      const coords = await getCoords();
      await sendBeat(emotion, coords?.latitude ?? null, coords?.longitude ?? null);
      // success
      btn.classList.remove('animating');
      btn.classList.add('registered');
      btn.textContent = 'Registrado ✓';
      announceSR(`Registrado ${emotion}`);
    } catch (err) {
      console.error(err);
      btn.classList.remove('animating');
      btn.classList.add('error');
      btn.textContent = 'Erro';
      announceSR('Erro ao registrar');
    }

    // restore after short delay
    setTimeout(() => {
      btn.classList.remove('registered','error');
      btn.disabled = false;
      btn.textContent = origText;
      btn.setAttribute('aria-pressed','false');
    }, 900);
  });
});

function announceSR(text){
  if (srAnnounce) {
    srAnnounce.textContent = '';
    setTimeout(() => { srAnnounce.textContent = text; }, 100);
  }
}

async function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition((pos) => {
      clearTimeout(timer);
      resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    }, () => { clearTimeout(timer); resolve(null); }, { maximumAge: 60_000, timeout: 4000 });
  });
}

async function sendBeat(emotion, lat = null, lng = null) {
  const args = { p_emotion: emotion };
  if (lat !== null && lng !== null) { args.p_lat = lat; args.p_lng = lng; }
  const { data, error } = await supabase.rpc('cast_beat', args);
  if (error) throw error;
  // refresh live quickly after sending
  fetchLive();
  return data;
}

async function fetchLive() {
  const { data, error } = await supabase.rpc('get_live');
  if (error) {
    console.error('get_live error', error);
    liveCountsEl.textContent = 'Erro ao obter dados ao vivo';
    return;
  }
  const payload = Array.isArray(data) ? data[0] : data;
  if (!payload) {
    liveCountsEl.textContent = 'Sem dados';
    return;
  }
  const counts = payload.counts || {};
  const parts = payload.participants || 0;
  const cities = payload.cities || 0;
  const states = payload.states || 0;

  liveCountsEl.innerHTML = EMOTIONS.map(k => {
    const v = counts[k] || 0;
    return `<div class="count" aria-label="${k} ${v}"><strong>${k}</strong>: ${v}</div>`;
  }).join('');
  liveParticipantsEl.textContent = `${parts} batimentos (últimos 15 min) • cidades: ${cities} • estados: ${states}`;
}

async function fetchAtlas() {
  const { data, error } = await supabase
    .from('daily_atlas')
    .select('day,participations,dominant,color,distribution,soundscape_id')
    .order('day', { ascending: false })
    .limit(10);
  if (error) {
    console.error('daily_atlas error', error);
    atlasListEl.textContent = 'Erro ao obter atlas';
    return;
  }
  if (!data || data.length === 0) {
    atlasListEl.textContent = 'Nenhum dado no atlas ainda';
    return;
  }

  atlasListEl.innerHTML = data.map(d => {
    const dist = d.distribution || {};
    // build distribution bar segments
    const segs = EMOTIONS.map(e => {
      const v = dist[e] || 0;
      const pct = Math.round(v * 100);
      const color = EMO_COLORS[e] || '#888';
      return `<div class="dist-seg" title="${e}: ${pct}%" style="width:${pct}%;background:${color}"></div>`;
    }).join('');

    // legend items
    const legend = EMOTIONS.map(e => `<div class="legend-item"><span class="legend-swatch" style="background:${EMO_COLORS[e]}"></span>${e}</div>`).join('');

    // accessible summary
    const summary = EMOTIONS.map(e => `${e}: ${Math.round((dist[e]||0)*100)}%`).join(', ');

    return `<div class="atlas-card" role="group" aria-label="Atlas ${d.day}: ${d.dominant} (${d.participations} participações)">
      <div class="atlas-day">${d.day}</div>
      <div class="atlas-dominant">${d.dominant} — ${d.participations} participações</div>
      <div class="dist-bar">${segs}</div>
      <div class="dist-legend">${legend}</div>
      <div class="atlas-sound">${d.soundscape_id}</div>
      <div class="sr-only">${summary}</div>
    </div>`;
  }).join('');
}

// initial load
fetchLive();
fetchAtlas();
// refresh live every 8s and atlas every 60s
setInterval(fetchLive, 8000);
setInterval(fetchAtlas, 60_000);

// Realtime subscription (best-effort, optional)
try {
  if (supabase && supabase.channel) {
    supabase.channel('public:beats').on('postgres_changes', { event: '*', schema: 'public', table: 'beats' }, (payload) => {
      fetchLive();
    }).subscribe();
  }
} catch (e) {
  // ignore if realtime not available
}

// expose helpers for debugging
window.pulso = { fetchLive, fetchAtlas, sendBeat };
