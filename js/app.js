// app.js — Application entry point
import {
  populateReciters,
  fetchSurahs,
  setupListeners,
  updateAudioPreview,
  setStatus,
  getActiveMode,
  getCustomAudioFile,
  showVideoUploadSection
} from './ui.js';

import {
  RECITERS,
  generateASSFile,
  generateASSContent,
  buildSegmentsFromWords
} from './ass.js';

import { initPreview, loadPreview } from './preview.js';

const BACKEND_URL = 'http://localhost:8001';

// Expose setStatus globally so ass.js can call window.setStatus
window.setStatus = setStatus;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
(async () => {
  try {
    initPreview();           // wire bg video input immediately — don't wait for ASS generation
    setStatus('Ready.');
    populateReciters();
    await fetchSurahs();
    updateAudioPreview();
    setupListeners();

    document.getElementById('renderBtn').addEventListener('click', async () => {
      const mode = getActiveMode();
      console.log(`[app] Render clicked. Mode: ${mode}`);

      if (mode === 'A') {
        console.log('[app] Mode A — generateASSFile');
        await generateASSFile();
        if (window._lastASS) {
          showVideoUploadSection();
          enableAssDownload();
          console.log('[app] Download button shown after Mode A success.');
        }
      } else {
        console.log('[app] Mode B — custom audio');
        await generateASSFromCustomAudio();
      }
    });

    document.getElementById('renderVideoBtn').addEventListener('click', renderVideo);

  } catch (err) {
    console.error('[app] Init error:', err);
    setStatus('Initialization failed: ' + err.message, true);
  }
})();

// ─────────────────────────────────────────────
// ASS DOWNLOAD BUTTON
// ─────────────────────────────────────────────
function enableAssDownload() {
  const btn = document.getElementById('downloadAssBtn');
  if (!btn || !window._lastASS) return;
  btn.style.display = 'inline-block';
  btn.onclick = () => {
    const blob = new Blob([window._lastASS.content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = window._lastASS.filename;
    a.click();
  };
}

// ─────────────────────────────────────────────
// MODE B — custom audio → ASS
// ─────────────────────────────────────────────
async function generateASSFromCustomAudio() {
  const audioFile = getCustomAudioFile();
  const btn = document.getElementById('renderBtn');

  if (!audioFile) {
    setStatus('Please upload an audio file first.', true);
    return;
  }

  console.log(`[app] Mode B: file=${audioFile.name}`);
  btn.disabled = true;

  try {
    // STEP 1 — transcribe
    setStatus('Uploading audio to backend...');
    const formData = new FormData();
    formData.append('file', audioFile);

    const response = await fetch(`${BACKEND_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Backend error: ${err.detail || response.statusText}`);
    }

    const result = await response.json();
    console.log(`[app] Transcription done. Words: ${result.word_count}, Lang: ${result.language}`);

    if (!result.success || result.words.length === 0) {
      throw new Error('Transcription returned no words.');
    }

    // STEP 2 — build segments
    setStatus('Building subtitles...');
    const segments = buildSegmentsFromWords(result.words);
    if (segments.length === 0) throw new Error('No segments generated.');

    // STEP 3 — generate ASS with UI style options
    setStatus('Generating ASS...');
    const styleOpts = readStyleFromUI();
    const assContent = generateASSContent(segments, styleOpts);
    const baseName = audioFile.name.replace(/\.[^.]+$/, '');
    window._lastASS = { content: assContent, filename: `${baseName}.ass` };

    enableAssDownload();

    // STEP 4 — preview
    const audioSrc = URL.createObjectURL(audioFile);
    const totalMs = segments[segments.length - 1].end_ms + 300;
    loadPreview(segments, audioSrc, totalMs);

    showVideoUploadSection();
    setStatus(`Done! ${segments.length} subtitles generated.`);
    console.log('[app] Mode B complete.');

  } catch (err) {
    setStatus('Error: ' + err.message, true);
    console.error('[app] Mode B error:', err);
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// READ UI STYLE (shared between Mode A and B)
// ─────────────────────────────────────────────
function readStyleFromUI() {
  const get = (idA, idB, fallback) => {
    const el = document.getElementById(idA) || document.getElementById(idB);
    return el ? el.value : fallback;
  };
  const fontSize = parseInt(get('fontSizeSlider', 'fontSizeInput', '24'), 10);
  const subtitleColor = get('subtitleColor', 'subtitleColour', '#FFFFFF');
  const outlineColor = get('outlineColor', 'outlineColour', '#000000');
  const position = get('subtitlePosition', 'subtitlePos', '2');
  return { fontSize, subtitleColor, outlineColor, subtitlePosition: position };
}

// ─────────────────────────────────────────────
// RENDER VIDEO
// ─────────────────────────────────────────────
async function renderVideo() {
  const mode = getActiveMode();
  const videoFile = document.getElementById('bgVideoInput').files[0];
  const muteVideo = document.getElementById('muteVideoCheck').checked;
  const btn = document.getElementById('renderVideoBtn');
  const subtitlePosition = document.getElementById('subtitlePosition')?.value || '2';

  if (!videoFile) {
    setStatus('Please upload a background video first.', true);
    return;
  }
  if (!window._lastASS) {
    setStatus('Generate ASS first before rendering.', true);
    return;
  }

  btn.disabled = true;
  setStatus('Rendering video… this may take a minute.');
  console.log(`[render] Mode: ${mode}, video: ${videoFile.name}, mute: ${muteVideo}`);

  try {
    // Build audio blob
    let audioBlob;
    if (mode === 'B') {
      const audioFile = getCustomAudioFile();
      if (!audioFile) throw new Error('No audio file for Mode B.');
      audioBlob = audioFile;
    } else {
      const recSelect = document.getElementById('reciterSelect');
      const rec = RECITERS[recSelect.value];
      const surahId = document.getElementById('surahSelect').value;
      const startAyah = parseInt(document.getElementById('ayahFrom').value);
      const endAyah = parseInt(document.getElementById('ayahTo').value);

      setStatus('Fetching audio for render…');
      const blobs = [];
      for (let ayah = startAyah; ayah <= endAyah; ayah++) {
        const url = `https://everyayah.com/data/${rec.folder}/${String(surahId).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
        const resp = await fetch(url);
        if (resp.ok) blobs.push(await resp.blob());
      }
      if (blobs.length === 0) throw new Error('Failed to fetch reciter audio.');
      audioBlob = new Blob(blobs, { type: 'audio/mpeg' });
    }

    // Read UI controls
    const autoScale = document.getElementById('autoScaleFont').checked;
    const fontSize = document.getElementById('fontSizeSlider').value;
    const subtitleColor = document.getElementById('subtitleColor').value;
    const outlineColor = document.getElementById('outlineColor').value;

    console.log(`[render] font:${fontSize}px autoScale:${autoScale} color:${subtitleColor} outline:${outlineColor}`);

    const assBlob = new Blob([window._lastASS.content], { type: 'text/plain' });

    const fd = new FormData();
    fd.append('video', videoFile, videoFile.name);
    fd.append('audio', audioBlob, 'audio.mp3');
    fd.append('ass', assBlob, 'subtitles.ass');   // backend receives ASS now
    fd.append('mute_video', muteVideo ? 'true' : 'false');
    fd.append('mode', mode);
    fd.append('font_size', fontSize);
    fd.append('auto_scale', autoScale ? 'true' : 'false');
    fd.append('subtitle_color', subtitleColor);
    fd.append('outline_color', outlineColor);
    fd.append('subtitle_position', subtitlePosition);

    const response = await fetch(`${BACKEND_URL}/render`, {
      method: 'POST',
      body: fd
    });

    if (!response.ok) {
      const err = await response.json();
      const detail = Array.isArray(err.detail)
        ? err.detail.map(e => `${e.loc?.join('.')} — ${e.msg}`).join(' | ')
        : (err.detail || response.statusText);
      throw new Error(detail);
    }

    const mp4Blob = await response.blob();
    const mp4Url = URL.createObjectURL(mp4Blob);

    const downloadBtns = document.getElementById('downloadBtns');
    const downloadMp4Btn = document.getElementById('downloadMp4Btn');
    downloadBtns.style.display = 'flex';
    downloadMp4Btn.onclick = () => {
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = 'reel_output.mp4';
      a.click();
    };

    setStatus('Done! Download your MP4 below.');
    console.log('[render] Done.');

  } catch (err) {
    setStatus('Render error: ' + err.message, true);
    console.error('[render] Error:', err);
  } finally {
    btn.disabled = false;
  }
}