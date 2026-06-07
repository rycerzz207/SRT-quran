// ui.js: UI-related functions
import { RECITERS, generateSRT } from './srt.js';

// Utility to set status messages
export function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
}

// Fetch surahs list from Quran.com API and populate selector
export async function fetchSurahs() {
  try {
    const resp = await fetch('https://api.quran.com/api/v4/chapters?language=en');
    const data = await resp.json();
    if (!data || !data.chapters) throw new Error('Invalid surah response');
    // We'll store surahs in a global variable for use in surahChanged
    // Since we are using modules, we can attach to window or use a shared object.
    // For simplicity, we'll attach to window (as the original did with state.surahs)
    window.state = window.state || {};
    window.state.surahs = data.chapters;
    const select = document.getElementById('surahSelect');
    select.innerHTML = '';
    data.chapters.forEach(ch => {
      const option = document.createElement('option');
      option.value = ch.id;
      option.textContent = `${ch.id}. ${ch.name_arabic} — ${ch.name_simple} (${ch.verses_count} verses)`;
      select.appendChild(option);
    });
    // Trigger update for ayah range defaults
    surahChanged();
  } catch (err) {
    setStatus('Failed to load surahs: ' + err.message, true);
    console.error(err);
  }
}

// Populate reciter selector
export function populateReciters() {
  const select = document.getElementById('reciterSelect');
  select.innerHTML = '';
  RECITERS.forEach((rec, idx) => {
    const opt = document.createElement('option');
    opt.value = idx; // use index as key
    opt.textContent = rec.name;
    // store folder and id as data attributes
    opt.dataset.folder = rec.folder;
    opt.dataset.recId = rec.recitation_id;
    select.appendChild(opt);
  });
}

// Update ayah range inputs when surah changes
export function surahChanged() {
  const select = document.getElementById('surahSelect');
  const surahId = parseInt(select.value, 10);
  const surah = window.state.surahs.find(s => s.id === surahId);
  if (!surah) return;
  const fromInput = document.getElementById('ayahFrom');
  const toInput = document.getElementById('ayahTo');
  fromInput.max = surah.verses_count;
  toInput.max = surah.verses_count;
  // set defaults if empty
  if (!fromInput.value) fromInput.value = 1;
  if (!toInput.value) toInput.value = Math.min(5, surah.verses_count);
}

// Update audio preview when reciter or ayah range changes
export async function updateAudioPreview() {
  const recSelect = document.getElementById('reciterSelect');
  const rec = RECITERS[recSelect.value];
  if (!rec) return;

  const surahId = document.getElementById('surahSelect').value;
  const startAyah = parseInt(document.getElementById('ayahFrom').value) || 1;
  const endAyah = parseInt(document.getElementById('ayahTo').value) || startAyah;
  const audio = document.getElementById('audioPreview');

  // Reset while loading
  audio.src = '';

  try {
    const blobs = [];
    for (let ayah = startAyah; ayah <= endAyah; ayah++) {
      const url = `https://everyayah.com/data/${rec.folder}/${String(surahId).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      blobs.push(await resp.blob());
    }
    if (blobs.length === 0) return;
    const combined = new Blob(blobs, { type: 'audio/mpeg' });
    audio.src = URL.createObjectURL(combined);
  } catch (err) {
    console.error('Audio preview error:', err);
  }
}

// Set up event listeners
export function setupListeners() {
  document.getElementById('surahSelect').addEventListener('change', () => {
    surahChanged();
    updateAudioPreview();
  });
  document.getElementById('ayahFrom').addEventListener('input', updateAudioPreview);
  document.getElementById('ayahTo').addEventListener('input', updateAudioPreview);
  document.getElementById('reciterSelect').addEventListener('change', updateAudioPreview);
  document.getElementById('renderBtn').addEventListener('click', async () => {
    const btn = document.getElementById('renderBtn');
    btn.disabled = true;
    try {
      await generateSRT(); // generateSRT is imported from srt.js in app.js
    } finally {
      btn.disabled = false;
    }
  });
}