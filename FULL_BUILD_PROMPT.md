# Quran Reel Creator — Full Build Prompt

Build a Quran subtitle (SRT) generator app. Follow the steps in order. Do not skip ahead.

---

## Project Structure

Create this exact structure:

```
quran-reel-maker/
├── index.html
├── style.css
├── js/
│   ├── app.js
│   ├── ui.js
│   └── srt.js
└── data/
    ├── surahs.json
    ├── verses.json
    └── timings/
        ├── mishary.json
        ├── sudais.json
        ├── husary.json
        ├── minshawi.json
        ├── saad.json
        └── abdulbasit.json
```

---

## Step 1 — Fetch and save data files

Write a Python script called `fetch_data.py` that downloads and saves all required JSON data. Run it once to populate the `data/` folder.

### 1A — surahs.json

Fetch from:
```
https://api.quran.com/api/v4/chapters?language=en
```

Save as `data/surahs.json` in this format:
```json
[
  {
    "id": 1,
    "name_arabic": "الفاتحة",
    "name_english": "Al-Fatiha",
    "verses_count": 7
  }
]
```

### 1B — verses.json

Fetch all 114 surahs from:
```
https://api.quran.com/api/v4/verses/by_chapter/{surah_number}?words=true&word_fields=text_uthmani&per_page=300
```

Loop from surah 1 to 114. Save as `data/verses.json` in this format:
```json
{
  "1": [
    {
      "verse_number": 1,
      "words": ["بِسْمِ", "ٱللَّهِ", "ٱلرَّحْمَـٰنِ", "ٱلرَّحِيمِ"]
    }
  ]
}
```

Extract `text_uthmani` from each word. Key is surah number as string.

### 1C — timings/{reciter}.json

For each reciter, fetch word-level timestamps from:
```
https://api.quran.com/api/v4/recitations/{recitation_id}/by_chapter/{surah_number}
```

Reciters to fetch:
```python
RECITERS = [
    { "file": "mishary",    "recitation_id": 7   },
    { "file": "sudais",     "recitation_id": 5   },
    { "file": "husary",     "recitation_id": 3   },
    { "file": "minshawi",   "recitation_id": 4   },
    { "file": "saad",       "recitation_id": 9   },
    { "file": "abdulbasit", "recitation_id": 2   },
]
```

For each reciter, loop all 114 surahs and save as `data/timings/{file}.json` in this format:
```json
{
  "1": [
    {
      "verse_number": 1,
      "segments": [
        { "word_index": 0, "start_ms": 0, "end_ms": 1200 },
        { "word_index": 1, "start_ms": 1200, "end_ms": 2400 }
      ]
    }
  ]
}
```

Parse the raw `segments` array from quran.com API response:
- Each segment is an array: `[word_index, char_index, start_ms, end_ms]`
- Extract index 0 (word_index), 2 (start_ms), 3 (end_ms)

Add a 1 second delay between requests to avoid rate limiting.
Save progress to console. Skip a surah if the request fails and continue.

---

## Step 2 — index.html

HTML structure only. No inline CSS or JS.

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quran Reel Creator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <h1 class="title">Quran Reel Creator</h1>

    <label for="surahSelect">Surah</label>
    <select id="surahSelect"></select>

    <label>Ayah range</label>
    <div class="range-group">
      <input type="number" id="ayahFrom" min="1" value="1" placeholder="From" />
      <input type="number" id="ayahTo" min="1" value="5" placeholder="To" />
    </div>

    <label for="reciterSelect">Reciter</label>
    <select id="reciterSelect"></select>

    <label for="audioPreview">Audio preview</label>
    <audio id="audioPreview" controls></audio>

    <button id="generateBtn">Generate SRT</button>

    <div id="status"></div>
  </div>

  <script src="js/srt.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

## Step 3 — style.css

Dark theme. Clean, minimal.

Rules:
- Background: `#0a0a0a`
- Text: `#ffffff`
- Accent / button: `#22c55e`
- Font: system sans-serif for UI, Amiri for Arabic text
- Max-width: `480px`, centered with `margin: 0 auto`
- Padding: `24px`
- All inputs and selects: dark background `#1a1a1a`, white text, border `1px solid #333`, border-radius `8px`, padding `10px`, width `100%`
- Button: full width, green background `#22c55e`, black text, bold, border-radius `8px`, padding `14px`, cursor pointer, font-size `16px`
- Button disabled state: opacity `0.5`, cursor not-allowed
- Labels: display block, margin-bottom `6px`, color `#aaa`, font-size `14px`
- Spacing between form groups: `margin-bottom: 20px`
- `.range-group`: display flex, gap `12px`
- `.range-group input`: flex 1
- `#status`: margin-top `16px`, font-size `14px`, min-height `20px`
- `.error`: color `#ef4444`
- `.success`: color `#22c55e`
- `audio`: width `100%`

---

## Step 4 — js/ui.js

Handles all DOM interaction. No fetch logic here.

```javascript
const RECITERS = [
  { name: "Mishary Al-Afasy",    file: "mishary",    folder: "Mishary_Alafasy_128kbps"        },
  { name: "Sudais",              file: "sudais",     folder: "Sudais_192kbps"                 },
  { name: "Husary",              file: "husary",     folder: "Husary_128kbps"                 },
  { name: "Minshawi Murattal",   file: "minshawi",   folder: "Minshawi_Murattal_128kbps"      },
  { name: "Saad Al-Ghamdi",      file: "saad",       folder: "Saad_Al_Ghamdi_128kbps"        },
  { name: "Abdul Basit Murattal",file: "abdulbasit", folder: "Abdul_Basit_Murattal_192kbps"  },
];

function populateSurahs(surahs) {
  // Populate #surahSelect
  // Display: {id}. {name_arabic} — {name_english} ({verses_count} verses)
}

function populateReciters() {
  // Populate #reciterSelect from RECITERS array
  // Use index as value
}

function updateAyahMax(versesCount) {
  // Set max attribute on #ayahFrom and #ayahTo
  // If current value exceeds max, cap it
}

function updateAudioPreview(surahId, ayahFrom, reciterIndex) {
  // Build URL: https://everyayah.com/data/{folder}/{surah:03d}{ayah:03d}.mp3
  // Set as src of #audioPreview
}

function setStatus(msg, type = 'info') {
  // type: 'info', 'error', 'success'
  // Set text and class on #status
}

function setLoading(isLoading) {
  // Disable/enable #generateBtn
  // Change button text to 'Generating...' or 'Generate SRT'
}
```

---

## Step 5 — js/srt.js

Pure logic. No DOM access.

```javascript
function buildSegments(surahVerses, surahTimings, startAyah, endAyah) {
  // surahVerses: array of verse objects for this surah
  // surahTimings: array of verse timing objects for this surah
  // Filter to startAyah..endAyah range
  // For each verse, match words with timing segments
  // Group words into subtitle lines:
  //   - One line per ayah by default
  //   - Split long ayahs (>10 words) at pause markers: ۖ ۗ ۘ ۙ ۚ ۛ
  // Append ayah number to last segment of each ayah: ﴿{number}﴾
  // Return: [{ text, start_ms, end_ms }, ...]
}

function toSRTTime(ms) {
  // Convert milliseconds to HH:MM:SS,mmm
  // Example: 61500 → "00:01:01,500"
}

function generateSRT(segments) {
  // Build SRT string from segments array
  // Format:
  // 1
  // 00:00:10,000 --> 00:00:25,000
  // مِّنَ الْمُؤْمِنِينَ رِجَالٌ
  //
  // 2
  // ...
  // Return as UTF-8 string
}

function downloadSRT(content, filename) {
  // Create Blob, trigger download, cleanup
}
```

---

## Step 6 — js/app.js

Main entry point. Wires everything together.

```javascript
let surahs = [];
let verses = {};
let currentTimings = {};

async function init() {
  // 1. Load data/surahs.json → populate surah dropdown
  // 2. Populate reciter dropdown
  // 3. Load data/verses.json into verses object
  // 4. Set up event listeners
  // 5. Set initial status: 'Ready.'
}

async function loadTimings(reciterFile) {
  // Fetch data/timings/{reciterFile}.json
  // Store in currentTimings
}

async function onSurahChange() {
  // Update ayah range max
  // Update audio preview
}

async function onReciterChange() {
  // Load timings for selected reciter
  // Update audio preview
}

async function onGenerate() {
  // 1. Get selected surah, ayah range, reciter
  // 2. setLoading(true)
  // 3. Get verses for selected surah from verses object
  // 4. Get timings for selected surah from currentTimings
  // 5. Call buildSegments()
  // 6. If no segments: show error
  // 7. Call generateSRT()
  // 8. Call downloadSRT()
  // 9. setStatus('Done! Import the SRT into CapCut.', 'success')
  // 10. setLoading(false)
  // Wrap in try/catch, show error if anything fails
}

document.addEventListener('DOMContentLoaded', init);
```

---

## Step 7 — Run and test

1. Run `python fetch_data.py` to populate the `data/` folder
2. Open `index.html` directly in browser (no server needed)
3. Verify surahs load in dropdown
4. Verify reciter loads
5. Verify audio preview plays
6. Select a surah and ayah range, click Generate SRT
7. Verify SRT file downloads with correct timestamps

---

## Rules

- No inline JS or CSS in index.html
- No external libraries except Google Fonts (Amiri)
- No API calls in the browser — all data comes from local JSON files
- Audio is the only external call (everyayah.com)
- Each JS file has one responsibility only
- Keep functions small and named clearly
