Continue the remaining fixes from FIX_JS_FILES.md. These are still pending:
1 — Fix fetchSurahs() in ui.js
Delete the current fetchSurahs() that calls https://api.quran.com/api/v4/chapters and replace with:
javascriptexport async function fetchSurahs() {
  try {
    const resp = await fetch('data/surahs.json');
    if (!resp.ok) throw new Error('Failed to load surahs.json');
    const surahs = await resp.json();
    window.state = window.state || {};
    window.state.surahs = surahs;
    const select = document.getElementById('surahSelect');
    select.innerHTML = '';
    surahs.forEach(ch => {
      const option = document.createElement('option');
      option.value = ch.id;
      option.textContent = `${ch.id}. ${ch.name_arabic} — ${ch.name_english} (${ch.verses_count} verses)`;
      select.appendChild(option);
    });
    surahChanged();
  } catch (err) {
    setStatus('Failed to load surahs: ' + err.message, true);
    console.error(err);
  }
}
2 — Add file property to RECITERS in srt.js
Update RECITERS to:
javascriptexport const RECITERS = [
  { name: "Mishary Al-Afasy",     file: "mishary",    folder: "Mishary_Alafasy_128kbps",      recitation_id: 7 },
  { name: "Abdul Basit Murattal", file: "abdulbasit", folder: "Abdul_Basit_Murattal_192kbps", recitation_id: 2 },
  { name: "Husary",               file: "husary",     folder: "Husary_128kbps",               recitation_id: 3 },
  { name: "Minshawi Murattal",    file: "minshawi",   folder: "Minshawi_Murattal_128kbps",    recitation_id: 4 },
  { name: "Saad Al-Ghamdi",       file: "saad",       folder: "Saad_Al_Ghamdi_128kbps",      recitation_id: 9 },
  { name: "Sudais",               file: "sudais",     folder: "Sudais_192kbps",               recitation_id: 5 },
];
3 — Fix timings path in fetchTimings() in srt.js
Change:
javascriptconst resp = await fetch(`data/timings/${reciter.folder}.json`);
To:
javascriptconst resp = await fetch(`data/timings/${reciter.file}.json`);
4 — Import generateSRT in ui.js
Add at the top of ui.js:
javascriptimport { generateSRT } from './srt.js';
Do not change anything else.