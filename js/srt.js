// srt.js — pure logic, no DOM access except generateSRT()

// Local stub — real setStatus is in ui.js
function setStatus(msg, isError = false) {
  console.log(isError ? '[ERROR]' : '[INFO]', msg);
}

export const RECITERS = [
  { name: "Mishary Al-Afasy", file: "mishary", folder: "Mishary_Alafasy_128kbps", recitation_id: 7 },
  { name: "Abdul Basit Murattal", file: "abdulbasit", folder: "Abdul_Basit_Murattal_64kbps", recitation_id: 2 },
  { name: "Husary", file: "husary", folder: "Husary_128kbps", recitation_id: 3 },
  { name: "Minshawi Murattal", file: "Minshawy", folder: "Minshawy_Murattal_128kbps", recitation_id: 4 },
  { name: "Saad Al-Ghamdi", file: "saad", folder: "Ghamadi_40kbps", recitation_id: 9 },
  { name: "Abdurrahmaan_As-Sudais", file: "sudais", folder: "Abdurrahmaan_As-Sudais_192kbps", recitation_id: 5 },
];

// Load verses for a surah from local JSON
export async function fetchVerses(surahId) {
  const resp = await fetch('data/verses.json');
  if (!resp.ok) throw new Error('Failed to load verses.json');
  const data = await resp.json();
  const surahVerses = data[String(surahId)];
  if (!surahVerses) throw new Error(`No verses found for surah ${surahId}`);
  return surahVerses;
}

// Load timings for a reciter+surah from local JSON
export async function fetchTimings(recitation_id, surahId) {
  const reciter = RECITERS.find(r => r.recitation_id === recitation_id);
  if (!reciter) throw new Error('Reciter not found');
  const resp = await fetch(`data/timings/${reciter.file}.json`);
  if (!resp.ok) throw new Error(`Failed to load timings for ${reciter.name}`);
  const data = await resp.json();
  const surahTimings = data[String(surahId)];
  if (!surahTimings) throw new Error(`No timings found for surah ${surahId}`);
  return surahTimings;
}

// Build subtitle segments from local verse + timing data
// verses: [{ verse_number, words: ["word1", "word2", ...] }]
// timings: [{ verse_number, segments: [{ word_index, start_ms, end_ms }] }]
export function buildSubtitleSegments(verses, timings, startAyah, endAyah) {
  console.log("=== DEBUG ===");
  console.log("Verses type:", typeof verses);
  console.log("Timings type:", typeof timings);
  console.log("First verse:", verses?.[0]);
  console.log("First timing:", timings?.[0]);

  const PAUSE_MARKERS = ['ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ'];
  const segments = [];

  for (let ayah = startAyah; ayah <= endAyah; ayah++) {
    const verse = verses.find(v => v.verse_number === ayah);
    const timing = timings.find(t => t.verse_number === ayah);

    console.log(`Ayah ${ayah}`);
    console.log("Verse found:", !!verse);
    console.log("Timing found:", !!timing);

    if (!verse) {
      console.warn(`Missing verse ${ayah}`);
      continue;
    }

    if (!timing) {
      console.warn(`Missing timing ${ayah}`);
      continue;
    }

    console.log("Verse object:", verse);
    console.log("Timing object:", timing);

    const words = verse.words || [];
    const segs = timing.segments || [];

    console.log("Words count:", words.length);
    console.log("Segments count:", segs.length);

    if (!words.length) {
      console.warn(`Ayah ${ayah} has no words`);
      continue;
    }

    if (!segs.length) {
      console.warn(`Ayah ${ayah} has no timing segments`);
      continue;
    }

    const timingMap = {};
    segs.forEach(s => {
      timingMap[s.word_index] = s;
    });

    const lines = [];
    let currentLine = [];

    words.forEach((word, idx) => {
      currentLine.push({ word, idx });
      if (PAUSE_MARKERS.some(m => word.includes(m))) {
        lines.push([...currentLine]);
        currentLine = [];
      }
    });

    if (currentLine.length) {
      lines.push(currentLine);
    }

    lines.forEach((line, lineIdx) => {
      const text = line.map(w => w.word).join(" ");
      const firstTiming = timingMap[line[0].idx];
      const lastTiming = timingMap[line[line.length - 1].idx];

      console.log("First timing:", firstTiming);
      console.log("Last timing:", lastTiming);

      if (!firstTiming || !lastTiming) {
        console.warn(`Timing missing for ayah ${ayah}`);
        return;
      }

      const isLast = lineIdx === lines.length - 1;
      segments.push({
        text: isLast ? `${text} ﴿${ayah}﴾` : text,
        start_ms: firstTiming.start_ms,
        end_ms: lastTiming.end_ms
      });
    });
  }

  console.log("Generated segments:", segments.length);
  return segments;
}

// Convert ms to SRT time format HH:MM:SS,mmm
export function msToSRTTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mil = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
}

// Generate SRT file content from segments
export function generateSRTContent(segments) {
  return segments.map((seg, i) =>
    `${i + 1}\n${msToSRTTime(seg.start_ms)} --> ${msToSRTTime(seg.end_ms)}\n${seg.text}`
  ).join('\n\n');
}

// Trigger browser download of SRT file
export function downloadSRT(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// Main generate function — called from ui.js button
export async function generateSRT() {
  const surahId = parseInt(document.getElementById('surahSelect').value);
  const startAyah = parseInt(document.getElementById('ayahFrom').value);
  const endAyah = parseInt(document.getElementById('ayahTo').value);
  const recIdx = document.getElementById('reciterSelect').value;
  const rec = RECITERS[recIdx];
  const btn = document.getElementById('renderBtn');

  if (!surahId || !startAyah || !endAyah || !rec) {
    setStatus('Please fill in all fields.', true); return;
  }

  btn.disabled = true;
  try {
    setStatus('Loading verses...');
    const verses = await fetchVerses(surahId);

    setStatus('Reading audio durations...');
    const segments = [];
    let cursor = 0;

    for (let ayah = startAyah; ayah <= endAyah; ayah++) {
      const verse = verses.find(v => v.verse_number === ayah);
      if (!verse) continue;

      const url = `https://everyayah.com/data/${rec.folder}/${String(surahId).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
      const duration = await getAudioDuration(url);
      const start_ms = cursor;
      const end_ms = cursor + Math.round(duration * 1000);
      cursor = end_ms + 300; // 300ms gap between ayahs

      const text = verse.words.join(' ') + ` ﴿${ayah}﴾`;
      segments.push({ text, start_ms, end_ms });
    }

    if (segments.length === 0) {
      setStatus('No verses found in this range.', true); return;
    }

    setStatus('Generating SRT...');
    const srtContent = generateSRTContent(segments);
    downloadSRT(srtContent, `quran_${surahId}_${startAyah}-${endAyah}.srt`);
    setStatus('Done! Import the SRT into CapCut with your video and audio.');

  } catch (err) {
    setStatus('Error: ' + err.message, true);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

function getAudioDuration(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => reject(new Error(`Failed to load audio: ${url}`)));
    audio.src = url;
  });
}
