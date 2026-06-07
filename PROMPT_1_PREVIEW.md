# Prompt 1 — Create js/preview.js

Create a new file `js/preview.js`. This file handles the SRT preview player. Do not touch any other file.

---

## What it does

After the user generates an SRT, a preview panel appears below the Generate SRT button. It plays the audio and shows one ayah at a time in sync with the audio — exactly like a Quran reel video but without a background video.

---

## HTML elements to inject

When `initPreview()` is called, dynamically create and inject this structure after `#generateBtn` in the DOM:

```html
<div id="previewPanel" style="display:none">
  <div id="previewScreen">
    <p id="previewText"></p>
  </div>
  <div id="previewControls">
    <button id="previewPlayBtn">▶ Play</button>
    <div id="previewBar">
      <div id="previewProgress"></div>
    </div>
    <span id="previewTime">0:00 / 0:00</span>
  </div>
</div>
```

---

## Styling (inject via JS, no changes to style.css)

```javascript
const styles = `
  #previewPanel {
    margin-top: 24px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #333;
  }
  #previewScreen {
    background: #000;
    width: 100%;
    aspect-ratio: 9/16;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
  }
  #previewText {
    font-family: 'Amiri', serif;
    font-size: 22px;
    color: white;
    text-align: center;
    direction: rtl;
    line-height: 1.8;
    margin: 0;
    transition: opacity 0.3s ease;
  }
  #previewControls {
    background: #111;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  #previewPlayBtn {
    width: auto;
    margin: 0;
    padding: 8px 16px;
    font-size: 14px;
    flex-shrink: 0;
  }
  #previewBar {
    flex: 1;
    height: 4px;
    background: #333;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
  }
  #previewProgress {
    height: 100%;
    background: #22c55e;
    border-radius: 2px;
    width: 0%;
    transition: width 0.1s linear;
  }
  #previewTime {
    font-size: 12px;
    color: #aaa;
    flex-shrink: 0;
    white-space: nowrap;
  }
`;
```

Inject styles into `<head>` using a `<style>` tag on first call.

---

## Module state

```javascript
let previewAudio = null;   // Audio element
let previewSegments = [];  // Array of { text, start_ms, end_ms }
let animFrame = null;      // requestAnimationFrame handle
```

---

## Functions

### `initPreview()`
- Inject HTML and styles into DOM (only once — check if already injected)
- Set up click handler on `#previewPlayBtn` → calls `togglePlay()`
- Set up click handler on `#previewBar` → seek audio to clicked position

### `loadPreview(segments, audioSrc)`
- Store segments in module state
- Create new `Audio(audioSrc)` element, store in `previewAudio`
- Show `#previewPanel`
- Reset progress bar and time to 0
- Set `#previewText` to first segment text
- Call `initPreview()` if not already done

### `togglePlay()`
- If audio is paused → play, update button to `⏸ Pause`, start `updateLoop()`
- If audio is playing → pause, update button to `▶ Play`, cancel `animFrame`

### `updateLoop()`
- Called via `requestAnimationFrame` while audio is playing
- Get `currentTime` from `previewAudio` in milliseconds
- Find the active segment: last segment where `start_ms <= currentTimeMs`
- If active segment changed → update `#previewText` with fade:
  ```javascript
  previewText.style.opacity = '0';
  setTimeout(() => {
    previewText.textContent = activeSegment.text;
    previewText.style.opacity = '1';
  }, 150);
  ```
- Update `#previewProgress` width: `(currentTime / duration) * 100`%
- Update `#previewTime`: format as `M:SS / M:SS`
- If audio ended → reset button to `▶ Play`, cancel loop
- Call `requestAnimationFrame(updateLoop)` to continue

### `formatTime(seconds)`
- Convert seconds to `M:SS` format
- Example: `61` → `"1:01"`

---

## Exports

```javascript
export { initPreview, loadPreview };
```

---

## Integration note

`loadPreview()` will be called from `app.js` after SRT generation completes, passing:
- `segments` — the array of `{ text, start_ms, end_ms }` objects
- `audioSrc` — the everyayah.com URL for the first ayah (Mode A) or the uploaded file blob URL (Mode B)

Do not call it from anywhere yet — just build and export the functions.

---

## Rules

- No fetch calls in this file
- No changes to any other file
- Self-contained — all styles injected by the module itself
- Works with both everyayah.com URLs and local blob URLs as audio source
