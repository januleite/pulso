// script.js - Pulso do Brasil frontend (sem chaves)
// Este arquivo usa window.SUPABASE_URL e window.SUPABASE_ANON_KEY definidos em index.html

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

// Register click handlers for emotions
buttons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const emotion = btn.dataset.emotion;
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    try {
      const coords = await getCoords();
      await sendBeat(emotion, coords?.latitude ?? null, coords?.longitude ?? null);
      btn.textContent = 'Registrado 👍';
      setTimeout(() => { btn.disabled = false; btn.textContent = btn.dataset.emotionLabel || prettify(emotion); }, 900);
    } catch (err) {
      console.error(err);
      btn.textContent = 'Erro';
      setTimeout(() => { btn.disabled = false; btn.textContent = prettify(emotion); }, 900);
    }
  });
  // store original label
  btn.dataset.emotionLabel = btn.textContent;
});

function prettify(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

async function getCoords() {
  // try to obtain geolocation but do not fail if unavailable
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
  // call Supabase RPC cast_beat (security definer)
  const args = { p_emotion: emotion };
  if (lat !== null && lng !== null) { args.p_lat = lat; args.p_lng = lng; }
  const { data, error } = await supabase.rpc('cast_beat', args);
  if (error) throw error;
  return data;
}

async function fetchLive() {
  const { data, error } = await supabase.rpc('get_live');
  if (error) {
    console.error('get_live error', error);
    liveCountsEl.textContent = 'Erro ao obter dados ao vivo';
    return;
  }
  // RPC may return an array or object depending on Postgres; normalize
  const payload = Array.isArray(data) ? data[0] : data;
  if (!payload) {
    liveCountsEl.textContent = 'Sem dados';
    return;
  }
  const counts = payload.counts || {};
  const parts = payload.participants || 0;
  const cities = payload.cities || 0;
  const states = payload.states || 0;

  liveCountsEl.innerHTML = Object.keys(counts).map(k => {
    return `<div class="count"><strong>${k}</strong>: ${counts[k]}</div>`;
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
    const dist = JSON.stringify(d.distribution || {});
    return `<div class="atlas-card" style="border-left:4px solid ${d.color || '#ccc'}">
      <div class="atlas-day">${d.day}</div>
      <div class="atlas-dominant">${d.dominant} — ${d.participations} participações</div>
      <div class="atlas-sound">${d.soundscape_id}</div>
      <div class="atlas-dist">${dist}</div>
    </div>`;
  }).join('');
}

// initial load
fetchLive();
fetchAtlas();
// refresh live every 8s and atlas every 60s
setInterval(fetchLive, 8000);
setInterval(fetchAtlas, 60_000);

// If realtime is desired and Supabase project enabled Realtime, you can subscribe as well
try {
  if (supabase && supabase.channel) {
    const channel = supabase.channel('public:beats').on('postgres_changes', { event: '*', schema: 'public', table: 'beats' }, (payload) => {
      // when a new beat arrives, refresh live
      fetchLive();
    }).subscribe();
  }
} catch (e) {
  // ignore if realtime not available
}

// small helper for console debugging
window.pulso = { fetchLive, fetchAtlas, sendBeat };
