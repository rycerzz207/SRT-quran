// ass.js – ASS (Advanced SubStation Alpha) only implementation
// All subtitle generation, segment building, and helper utilities now target ASS.

import { loadPreview } from './preview.js';

/* ------------------------------------------------------------------
   UI helpers (status bar)
   ------------------------------------------------------------------ */
// The UI module (`ui.js`) attaches `setStatus` to the global `window` object
// to avoid a circular import.  This tiny wrapper forwards the call.
function _setStatus(msg, isError = false) {
  if (typeof window.setStatus === 'function') {
    window.setStatus(msg, isError);
  } else {
    console[isError ? 'error' : 'log'](msg);
  }
}

/* ------------------------------------------------------------------
   RECITERS DATA
   ------------------------------------------------------------------ */
export const RECITERS = [
  { name: "Mishary Al-Afasy", file: "mishary", folder: "Alafasy_128kbps", recitation_id: 7 },
  { name: "Abdul Basit Murattal", file: "abdulbasit", folder: "Abdul_Basit_Murattal_64kbps", recitation_id: 2 },
  { name: "Husary", file: "husary", folder: "Husary_128kbps", recitation_id: 3 },
  { name: "Minshawi Murattal", file: "Minshawy", folder: "Minshawy_Murattal_128kbps", recitation_id: 4 },
  { name: "Saad Al-Ghamdi", file: "saad", folder: "Ghamadi_40kbps", recitation_id: 9 },
  { name: "Abdurrahmaan_As-Sudais", file: "sudais", folder: "Abdurrahmaan_As-Sudais_192kbps", recitation_id: 5 }
];

/* ------------------------------------------------------------------
   DATA LOADERS
   ------------------------------------------------------------------ */
export async function fetchVerses(surahId) {
  const resp = await fetch('data/verses.json');
  if (!resp.ok) throw new Error('Failed to load verses.json');
  const data = await resp.json();
  const surahVerses = data[String(surahId)];
  if (!surahVerses) throw new Error(`No verses found for surah ${surahId}`);
  return surahVerses;
}

/* ------------------------------------------------------------------
   HEX → ASS colour helper
   ------------------------------------------------------------------ */
function hexToAssColour(hex) {
  // Accept "#RRGGBB" or "RRGGBB"
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6) return '&H00FFFFFF'; // fallback white
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  // ASS colour format: &HAABBGGRR (AA = alpha, 00 = opaque)
  return `&H00${b}${g}${r}`.toUpperCase();
}

/* ------------------------------------------------------------------
   READ STYLE OPTIONS FROM THE UI
   ------------------------------------------------------------------ */
/**
 * Returns an object containing the current subtitle‑style values.
 * Works for both Mode A (controls may be hidden) and Mode B.
 *
 * Expected IDs (any of them may exist):
 *   - Font size   : #fontSizeSlider or #fontSizeInput
 *   - Sub colour  : #subtitleColor or #subtitleColour
 *   - Outline col : #outlineColor  or #outlineColour
 *   - Position    : #subtitlePosition or #subtitlePos
 *
 * If a control is missing, a sensible default is used.
 */
function readStyleFromUI() {
  const get = (idA, idB, fallback) => {
    const el = document.getElementById(idA) || document.getElementById(idB);
    return el ? el.value : fallback;
  };

  const fontSize = parseInt(get('fontSizeSlider', 'fontSizeInput', 24), 10);
  const subColor = get('subtitleColor', 'subtitleColour', '#FFFFFF');
  const outColor = get('outlineColor', 'outlineColour', '#000000');
  const position = get('subtitlePosition', 'subtitlePos', '2');

  return {
    fontSize,
    subtitleColor: subColor,
    outlineColor: outColor,
    subtitlePosition: position
  };
}

/* ------------------------------------------------------------------
   TIME → ASS TIMESTAMP HELPER
   ------------------------------------------------------------------ */
function msToAssTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mil = ms % 1000;
  const cs = Math.round(mil / 10); // centiseconds (00‑99)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------
   BUILD THE `[V4+ Styles]` BLOCK FROM OPTION OBJECT
   ------------------------------------------------------------------ */
function buildAssHeader(opts = {}) {
  // Default values match the original hard‑coded style
  const {
    fontSize = 24,
    fontName = 'Arial',                     // will be overridden to QPC Hafs for Mode A
    primaryColour = '&H00FFFFFF',
    outlineColour = '&H00000000',
    outline = 2,
    shadow = 0,
    alignment = 2                           // 2 = bottom centre, 8 = top centre, 5 = middle centre
  } = opts;

  // Order of fields follows ASS v4+ specification
  return `Style: Default,${fontName},${fontSize},${primaryColour},${primaryColour},${outlineColour},&H00000000,0,0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},20,20,80,1`;
}

/* ------------------------------------------------------------------
   ASS CONTENT GENERATOR (pure text) – now accepts style options
   ------------------------------------------------------------------ */
export function generateASSContent(segments, styleOpts = {}) {
  const header = `[Script Info]
Title: Quran Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${buildAssHeader(styleOpts)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const alignment = styleOpts.alignment ?? 2;
  const anTag = `{\\an${alignment}}`;

  const body = segments
    .map(seg => {
      const start = msToAssTime(seg.start_ms);
      const end = msToAssTime(seg.end_ms);
      const escaped = seg.text
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}');
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${anTag}${escaped}`;
    })
    .join('\n');

  return `${header}\n${body}`;
}

/* ------------------------------------------------------------------
   ASS FROM SEGMENTS (Mode B) – thin wrapper around generateASSContent
   ------------------------------------------------------------------ */
export function generateASSFromSegments(segments) {
  return generateASSContent(segments);
}

/* ------------------------------------------------------------------
   BUILD SEGMENTS FROM WHISPER WORDS (Mode B)
   ------------------------------------------------------------------ */
export function buildSegmentsFromWords(words) {
  const WORDS_PER_LINE = 6;
  const segments = [];

  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    const chunk = words.slice(i, i + WORDS_PER_LINE);
    if (!chunk.length) continue;

    segments.push({
      text: chunk.map(w => w.word).join(' '),
      start_ms: chunk[0].start_ms,
      end_ms: chunk[chunk.length - 1].end_ms
    });
  }
  return segments;
}

/* ------------------------------------------------------------------
   MAIN generateASSFile() – Mode A (reciter)
   ------------------------------------------------------------------ */
export async function generateASSFile() {
  const surahId = parseInt(document.getElementById('surahSelect').value);
  const startAyah = parseInt(document.getElementById('ayahFrom').value);
  const endAyah = parseInt(document.getElementById('ayahTo').value);
  const recIdx = document.getElementById('reciterSelect').value;
  const rec = RECITERS[recIdx];
  const btn = document.getElementById('renderBtn');

  if (!surahId || !startAyah || !endAyah || !rec) {
    _setStatus('Please fill in all fields.', true);
    return;
  }

  btn.disabled = true;

  try {
    _setStatus('Loading verses...');
    const verses = await fetchVerses(surahId);

    _setStatus('Reading audio durations...');
    const segments = [];
    const audioBlobs = [];
    const durations = [];

    // ---------- 1️⃣ Fetch each ayah MP3 and keep its duration ----------
    for (let ayah = startAyah; ayah <= endAyah; ayah++) {
      const verse = verses.find(v => v.verse_number === ayah);
      if (!verse) continue;

      const url = `https://everyayah.com/data/${rec.folder}/${String(surahId).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
      const { blob, duration } = await fetchAudioBlob(url);
      audioBlobs.push(blob);
      durations.push(duration || 0);
    }

    // ---------- 2️⃣ Build a **gap‑free** timeline ----------
    let cursor = 0;               // start of first segment (ms)
    const GAP = 0;                // no artificial pause

    for (let i = 0; i < audioBlobs.length; i++) {
      const verse = verses.find(v => v.verse_number === startAyah + i);
      if (!verse) continue;

      const duration = durations[i] || 0;
      const start_ms = cursor;
      const end_ms = cursor + Math.round(duration * 1000);

      segments.push({
        text: verse.words.join(' ') + ` ﴿${startAyah + i}﴾`,
        start_ms,
        end_ms
      });

      cursor = end_ms + GAP; // no extra gap
    }

    if (segments.length === 0) {
      _setStatus('No verses found in this range.', true);
      return;
    }

    // ---------- 3️⃣ READ UI STYLE OPTIONS ----------
    const {
      fontSize,
      subtitleColor,
      outlineColor,
      subtitlePosition
    } = readStyleFromUI();

    const styleOpts = {
      fontSize,
      // Force the required font for Mode A
      fontName: 'QPC Hafs',
      primaryColour: hexToAssColour(subtitleColor),
      outlineColour: hexToAssColour(outlineColor),
      alignment: parseInt(subtitlePosition, 10)
    };

    // ---------- 4️⃣ Generate ASS ----------
    _setStatus('Generating ASS...');
    const assContent = generateASSContent(segments, styleOpts);
    const filename = `quran_${surahId}_${startAyah}-${endAyah}.ass`;

    // make it globally reachable for the render‑video flow
    window._lastASS = { content: assContent, filename };

    // ---------- 5️⃣ Prepare preview ----------
    const combinedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
    const previewAudioSrc = URL.createObjectURL(combinedBlob);

    // Pass the **total** duration (cursor holds the end of the last segment)
    loadPreview(segments, previewAudioSrc, cursor);

    _setStatus('Done! Import the ASS into your video editor with your video and audio.');
  } catch (err) {
    _setStatus('Error: ' + err.message, true);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------
   AUDIO HELPERS – used only by generateASSFile (Mode A)
   ------------------------------------------------------------------ */
async function fetchAudioBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch audio: ${url}`);
  const blob = await response.blob();
  const duration = await getBlobDuration(blob);
  return { blob, duration };
}

/**
 * Returns the duration (in seconds) of an `Audio`‐compatible Blob.
 * Uses a temporary `Audio` element – it’s async but lightweight.
 */
function getBlobDuration(blob) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const blobUrl = URL.createObjectURL(blob);
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(blobUrl);
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to read audio duration'));
    });
    audio.src = blobUrl;
  });
}