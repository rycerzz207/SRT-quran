// preview.js — SRT preview player

let previewAudio = null;
let previewSegments = [];
let animFrame = null;
let lastSegIndex = -1;
let totalDuration = 0; // ms — passed from srt.js since blob has no reliable duration
let injected = false;

function injectStyles() {
  if (document.getElementById('preview-styles')) return;
  const style = document.createElement('style');
  style.id = 'preview-styles';
  style.textContent = `
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
      height: 6px;
      background: #333;
      border-radius: 3px;
      cursor: pointer;
      position: relative;
    }
    #previewProgress {
      height: 100%;
      background: #22c55e;
      border-radius: 3px;
      width: 0%;
      pointer-events: none;
    }
    #previewTime {
      font-size: 12px;
      color: #aaa;
      flex-shrink: 0;
      white-space: nowrap;
      min-width: 80px;
      text-align: right;
    }
  `;
  document.head.appendChild(style);
}

function injectHTML() {
  if (document.getElementById('previewPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'previewPanel';
  panel.style.display = 'none';
  panel.innerHTML = `
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
  `;
  const btn = document.getElementById('renderBtn');
  btn.parentNode.insertBefore(panel, btn.nextSibling);
}

export function initPreview() {
  if (injected) return;
  injectStyles();
  injectHTML();

  document.getElementById('previewPlayBtn').addEventListener('click', togglePlay);

  document.getElementById('previewBar').addEventListener('click', (e) => {
    if (!previewAudio || !totalDuration) return;
    const bar = document.getElementById('previewBar');
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Use our known total duration — don't trust audio.duration on concatenated blobs
    previewAudio.currentTime = ratio * (totalDuration / 1000);
    updateDisplay();
  });

  injected = true;
}

// segments: [{ text, start_ms, end_ms }]
// audioSrc: blob URL of concatenated MP3
// durationMs: total duration in ms (calculated in srt.js)
export function loadPreview(segments, audioSrc, durationMs) {
  initPreview();

  previewSegments = segments;
  totalDuration = durationMs;
  lastSegIndex = -1;

  if (previewAudio) {
    previewAudio.pause();
    previewAudio.src = '';
  }

  previewAudio = new Audio(audioSrc);
  previewAudio.addEventListener('ended', onEnded);

  document.getElementById('previewPanel').style.display = 'block';
  document.getElementById('previewProgress').style.width = '0%';
  document.getElementById('previewPlayBtn').textContent = '▶ Play';
  document.getElementById('previewTime').textContent =
    `0:00 / ${formatTime(totalDuration / 1000)}`;

  if (segments.length > 0) {
    document.getElementById('previewText').textContent = segments[0].text;
  }
}

function onEnded() {
  document.getElementById('previewPlayBtn').textContent = '▶ Play';
  document.getElementById('previewProgress').style.width = '100%';
  cancelAnimationFrame(animFrame);
}

function togglePlay() {
  if (!previewAudio) return;
  if (previewAudio.paused) {
    previewAudio.play();
    document.getElementById('previewPlayBtn').textContent = '⏸ Pause';
    animFrame = requestAnimationFrame(updateLoop);
  } else {
    previewAudio.pause();
    document.getElementById('previewPlayBtn').textContent = '▶ Play';
    cancelAnimationFrame(animFrame);
  }
}

function updateLoop() {
  if (!previewAudio || previewAudio.paused) return;
  updateDisplay();
  animFrame = requestAnimationFrame(updateLoop);
}

function updateDisplay() {
  const currentMs = previewAudio.currentTime * 1000;
  const total = totalDuration || 1;

  // Find active segment
  let activeIndex = -1;
  for (let i = previewSegments.length - 1; i >= 0; i--) {
    if (currentMs >= previewSegments[i].start_ms) {
      activeIndex = i;
      break;
    }
  }

  // Update text only when segment changes
  if (activeIndex !== lastSegIndex && activeIndex >= 0) {
    lastSegIndex = activeIndex;
    const el = document.getElementById('previewText');
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = previewSegments[activeIndex].text;
      el.style.opacity = '1';
    }, 150);
  }

  // Progress bar — use our known total duration
  document.getElementById('previewProgress').style.width =
    `${Math.min(100, (currentMs / total) * 100)}%`;

  // Time display
  document.getElementById('previewTime').textContent =
    `${formatTime(currentMs / 1000)} / ${formatTime(total / 1000)}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}