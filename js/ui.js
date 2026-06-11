// ui.js – all UI‑related helpers (DOM manipulation, event wiring, status updates)
// ------------------------------------------------------------
// NOTE: This file **must** be loaded *before* `app.js` because
// `app.js` imports several of the exported symbols defined here.
// ------------------------------------------------------------
import { RECITERS } from './ass.js';

// ------------------------------------------------------------------
// GLOBAL STATE (private to this module)
// ------------------------------------------------------------------
let activeMode = 'A'; // 'A' = Reciter mode, 'B' = Custom‑audio mode

// ------------------------------------------------------------------
// PUBLIC getters used by other modules
// ------------------------------------------------------------------
export function getActiveMode() { return activeMode; }
export function getCustomAudioFile() {
  const input = document.getElementById('customAudioInput');
  return input?.files?.[0] || null;
}

// ------------------------------------------------------------------
// STATUS BAR helper
// ------------------------------------------------------------------
export function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'error' : '';
}

// ------------------------------------------------------------------
// SURAH / RECITER loading
// ------------------------------------------------------------------
export async function fetchSurahs() {
  try {
    const resp = await fetch('data/surahs.json');
    if (!resp.ok) throw new Error('Failed to load surahs.json');
    const surahs = await resp.json();
    window.state = window.state || {};
    window.state.surahs = surahs;

    const select = document.getElementById('surahSelect');
    select.innerHTML = '';
    surahs.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `${ch.id}. ${ch.name_arabic} — ${ch.name_english} (${ch.verses_count} verses)`;
      select.appendChild(opt);
    });

    // trigger a change so the ayah limits are set correctly
    surahChanged();
  } catch (err) {
    setStatus('Failed to load surahs: ' + err.message, true);
    console.error(err);
  }
}

export function populateReciters() {
  const select = document.getElementById('reciterSelect');
  select.innerHTML = '';

  RECITERS.forEach((rec, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;                // we use the array index as the key
    opt.textContent = rec.name;
    // keep the folder/id handy – useful for future extensions
    opt.dataset.folder = rec.folder;
    opt.dataset.recId = rec.recitation_id;
    select.appendChild(opt);
  });
}

// ------------------------------------------------------------------
// SURAH change → update the allowed ayah range
// ------------------------------------------------------------------
export function surahChanged() {
  const sel = document.getElementById('surahSelect');
  const surahId = parseInt(sel.value, 10);
  const surah = window.state?.surahs?.find(s => s.id === surahId);
  if (!surah) return;

  const from = document.getElementById('ayahFrom');
  const to = document.getElementById('ayahTo');

  from.max = surah.verses_count;
  to.max = surah.verses_count;

  // Preserve existing values when they are still valid
  if (!from.value || parseInt(from.value, 10) < 1) from.value = 1;
  if (!to.value || parseInt(to.value, 10) > surah.verses_count) to.value = Math.min(5, surah.verses_count);
}

// ------------------------------------------------------------------
// Audio preview for **Mode A** (reciter)
// ------------------------------------------------------------------
export async function updateAudioPreview() {
  const recSelect = document.getElementById('reciterSelect');
  const rec = RECITERS[recSelect.value];
  if (!rec) return;

  const surahId = document.getElementById('surahSelect').value;
  const startAyah = parseInt(document.getElementById('ayahFrom').value) || 1;
  const endAyah = parseInt(document.getElementById('ayahTo').value) || startAyah;
  const audioTag = document.getElementById('audioPreview');

  // Reset source while we load new data
  audioTag.src = '';

  try {
    const blobs = [];
    for (let ayah = startAyah; ayah <= endAyah; ayah++) {
      const url = `https://everyayah.com/data/${rec.folder}/${String(surahId).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      blobs.push(await resp.blob());
    }
    if (!blobs.length) return;
    const combined = new Blob(blobs, { type: 'audio/mpeg' });
    audioTag.src = URL.createObjectURL(combined);
  } catch (err) {
    console.error('Audio preview error:', err);
  }
}

// ------------------------------------------------------------------
// Show the *Video‑Upload / Render* section (used by both modes)
// ------------------------------------------------------------------
export function showVideoUploadSection() {
  const sec = document.getElementById('videoUploadSection');
  if (sec) sec.style.display = 'block';
}

// ------------------------------------------------------------------
// Mode‑toggle UI (A ↔ B)
// ------------------------------------------------------------------
export function setupModeToggle() {
  const subtitleDiv = document.getElementById('subtitlePositionDiv');
  const btnA = document.getElementById('modeABtn');
  const btnB = document.getElementById('modeBBtn');
  const panelA = document.getElementById('modeAPanel');
  const panelB = document.getElementById('modeBPanel');
  const renderBtn = document.getElementById('renderBtn');
  const quranControls = document.getElementById('quranControls');

  // ---------- A ----------
  btnA.addEventListener('click', () => {
    activeMode = 'A';
    btnA.classList.add('active');
    btnB.classList.remove('active');

    if (subtitleDiv) subtitleDiv.style.display = 'block';
    panelA.style.display = 'block';
    panelB.style.display = 'none';
    quranControls.style.display = 'block';
    renderBtn.textContent = 'Generate ASS';
    console.log('[ui] Switched to Mode A (reciter)');
  });

  // ---------- B ----------
  btnB.addEventListener('click', () => {
    activeMode = 'B';
    btnB.classList.add('active');
    btnA.classList.remove('active');

    if (subtitleDiv) subtitleDiv.style.display = 'block';
    panelA.style.display = 'none';
    panelB.style.display = 'block';
    quranControls.style.display = 'none';
    renderBtn.textContent = 'Transcribe & Generate ASS';

    // In Mode B we want the video‑upload UI visible right away

    console.log('[ui] Switched to Mode B (custom audio)');
  });
}

// ------------------------------------------------------------------
// Wire *all* UI controls (sliders, colour pickers, check‑boxes …)
// ------------------------------------------------------------------
export function setupListeners() {
  // Mode toggle (already defined above)
  setupModeToggle();

  // Reciter selector → update audio preview
  document.getElementById('reciterSelect')
    .addEventListener('change', updateAudioPreview);

  // Surah selector → update ayah limits & preview
  document.getElementById('surahSelect')
    .addEventListener('change', () => {
      surahChanged();
      updateAudioPreview();
    });

  // Ayah range inputs – simple validation
  const fromInput = document.getElementById('ayahFrom');
  const toInput = document.getElementById('ayahTo');
  fromInput.addEventListener('input', () => {
    const max = parseInt(fromInput.max, 10);
    if (parseInt(fromInput.value, 10) < 1) fromInput.value = 1;
    if (parseInt(fromInput.value, 10) > max) fromInput.value = max;
    // keep `to` always ≥ `from`
    if (parseInt(toInput.value, 10) < parseInt(fromInput.value, 10)) {
      toInput.value = fromInput.value;
    }
    updateAudioPreview();
  });
  toInput.addEventListener('input', () => {
    const max = parseInt(toInput.max, 10);
    if (parseInt(toInput.value, 10) < 1) toInput.value = 1;
    if (parseInt(toInput.value, 10) > max) toInput.value = max;
    // keep `from` always ≤ `to`
    if (parseInt(fromInput.value, 10) > parseInt(toInput.value, 10)) {
      fromInput.value = toInput.value;
    }
    updateAudioPreview();
  });

  // ----------------------------------------------------------------
  // Font‑size slider (affects preview & backend rendering)
  // ----------------------------------------------------------------
  const sizeSlider = document.getElementById('fontSizeSlider');
  const sizeLabel = document.getElementById('fontSizeValue');
  if (sizeSlider && sizeLabel) {
    sizeSlider.addEventListener('input', () => {
      sizeLabel.textContent = `${sizeSlider.value}px`;
    });
  }

  // ----------------------------------------------------------------
  // Subtitle colour & outline colour pickers
  // ----------------------------------------------------------------
  const subColor = document.getElementById('subtitleColor');
  const outlineClr = document.getElementById('outlineColor');
  [subColor, outlineClr].forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        // If a preview is active, force a redraw so the new colours appear instantly
        const preview = document.getElementById('subtitleOverlay');
        if (preview) preview.style.display = 'none'; // hide momentarily
        // The next call to `loadPreview` (or a manual refresh) will apply the colours.
      });
    }
  });

  // ----------------------------------------------------------------
  // Auto‑scale checkbox
  // ----------------------------------------------------------------
  const autoScaleChk = document.getElementById('autoScaleFont');
  if (autoScaleChk) {
    autoScaleChk.addEventListener('change', () => {
      // No immediate UI work needed; the flag is sent to the backend on render.
    });
  }

  // ----------------------------------------------------------------
  // Custom‑audio file selector (Mode B) – just update UI hint
  // ----------------------------------------------------------------
  const customAudioInput = document.getElementById('customAudioInput');
  const caHint = document.getElementById('customAudioHint');
  if (customAudioInput && caHint) {
    customAudioInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      caHint.textContent = file ? `Selected: ${file.name}` : 'No file chosen';
    });
  }

  // ----------------------------------------------------------------
  // Background video selector (used for rendering)
  // ----------------------------------------------------------------
  const bgVideoInput = document.getElementById('bgVideoInput');
  if (bgVideoInput) {
    bgVideoInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      const hint = document.getElementById('bgVideoHint');
      if (hint) hint.textContent = file ? `Video: ${file.name}` : 'No video selected';
    });
  }

  // ----------------------------------------------------------------
  // Subtitle position dropdown (only visible in Mode B)
  // ----------------------------------------------------------------
  const subPosSelect = document.getElementById('subtitlePosition');
  if (subPosSelect) {
    subPosSelect.addEventListener('change', () => {
      // No inline action – value is read by `app.js` when rendering.
    });
  }

  // ----------------------------------------------------------------
  // Mute‑video checkbox (used by the backend)
  // ----------------------------------------------------------------
  const muteChk = document.getElementById('muteVideoCheck');
  if (muteChk) {
    muteChk.addEventListener('change', () => {
      // nothing to do here – just read the flag later.
    });
  }
}

// ------------------------------------------------------------------
// Export any symbols that were *not* exported inline above.
// (All the functions defined with `export function …` are already exported.)
export {
  // (no extra exports needed right now)
};