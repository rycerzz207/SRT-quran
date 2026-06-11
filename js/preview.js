// preview.js — live video + subtitle preview only

let previewAudio = null;
let previewSegments = [];
let animFrame = null;
let lastSegIndex = -1;
let totalDuration = 0;
let injected = false;

/* ------------------------------------------------------------------
   STYLES
   ------------------------------------------------------------------ */
function injectStyles() {
  if (document.getElementById('preview-styles')) return;
  const style = document.createElement('style');
  style.id = 'preview-styles';
  style.textContent = `
    #livePreviewPanel {
      margin-top: 16px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #444;
      display: none;
    }
    #livePreviewLabel {
      background: #1a1a1a;
      color: #888;
      font-size: 12px;
      padding: 6px 12px;
      text-align: center;
      letter-spacing: 0.05em;
    }
    #livePreviewScreen {
      position: relative;
      width: 100%;
      aspect-ratio: 9/16;
      background: #000;
      overflow: hidden;
    }
    #livePreviewVideo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    #liveSubtitleOverlay {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      text-align: center;
      direction: rtl;
      pointer-events: none;
      font-family: 'Amiri', serif;
      transition: opacity 0.2s ease;
      bottom: 5%;
    }
    #livePreviewControls {
      background: #111;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #livePlayBtn {
      width: auto;
      margin: 0;
      padding: 8px 16px;
      font-size: 14px;
      flex-shrink: 0;
    }
    #livePreviewBar {
      flex: 1;
      height: 6px;
      background: #333;
      border-radius: 3px;
      cursor: pointer;
      position: relative;
    }
    #livePreviewProgress {
      height: 100%;
      background: #22c55e;
      border-radius: 3px;
      width: 0%;
      pointer-events: none;
    }
    #livePreviewTime {
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

/* ------------------------------------------------------------------
   HTML
   ------------------------------------------------------------------ */
function injectHTML() {
  if (document.getElementById('livePreviewPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'livePreviewPanel';
  panel.innerHTML = `
    <div id="livePreviewLabel">LIVE PREVIEW — adjust style before rendering</div>
    <div id="livePreviewScreen">
      <video id="livePreviewVideo" loop playsinline></video>
      <div id="liveSubtitleOverlay"></div>
    </div>
    <div id="livePreviewControls">
      <button id="livePlayBtn">▶ Play</button>
      <div id="livePreviewBar">
        <div id="livePreviewProgress"></div>
      </div>
      <span id="livePreviewTime">0:00 / 0:00</span>
    </div>
  `;

  // Insert after renderBtn
  const btn = document.getElementById('renderBtn');
  btn.parentNode.insertBefore(panel, btn.nextSibling);
}

/* ------------------------------------------------------------------
   INIT
   ------------------------------------------------------------------ */
export function initPreview() {
  if (injected) return;
  injectStyles();
  injectHTML();

  document.getElementById('livePlayBtn').addEventListener('click', togglePlay);

  document.getElementById('livePreviewBar').addEventListener('click', e => {
    if (!previewAudio || !totalDuration) return;
    const rect = document.getElementById('livePreviewBar').getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    previewAudio.currentTime = ratio * (totalDuration / 1000);
    updateDisplay();
  });

  // Live style controls
  ['subtitleColor', 'outlineColor', 'fontSizeSlider', 'subtitlePosition'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyLiveSubtitleStyle);
  });

  // Background video input
  document.getElementById('bgVideoInput')?.addEventListener('change', onBgVideoSelected);

  // Show panel immediately — video loads when user picks a file
  document.getElementById('livePreviewPanel').style.display = 'block';

  injected = true;
}

/* ------------------------------------------------------------------
   LOAD PREVIEW (called after ASS generation)
   ------------------------------------------------------------------ */
export function loadPreview(segments, audioSrc, durationMs) {
  initPreview();

  previewSegments = segments;
  totalDuration = durationMs;
  lastSegIndex = -1;

  if (previewAudio) { previewAudio.pause(); previewAudio.src = ''; }
  previewAudio = new Audio(audioSrc);
  previewAudio.addEventListener('ended', onEnded);

  document.getElementById('livePreviewTime').textContent =
    `0:00 / ${formatTime(totalDuration / 1000)}`;
  document.getElementById('livePreviewProgress').style.width = '0%';
  document.getElementById('livePlayBtn').textContent = '▶ Play';

  // Show first subtitle
  if (segments.length > 0) {
    const overlay = document.getElementById('liveSubtitleOverlay');
    if (overlay) overlay.textContent = segments[0].text;
  }

  applyLiveSubtitleStyle();

  // Show panel if bg video already loaded
  const vid = document.getElementById('livePreviewVideo');
  if (vid && vid.src) {
    document.getElementById('livePreviewPanel').style.display = 'block';
  }
}

/* ------------------------------------------------------------------
   BG VIDEO SELECTED — show live preview immediately
   ------------------------------------------------------------------ */
function onBgVideoSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  initPreview();

  const vid = document.getElementById('livePreviewVideo');
  vid.src = URL.createObjectURL(file);
  vid.muted = true;
  vid.play().catch(() => { });

  document.getElementById('livePreviewPanel').style.display = 'block';
  applyLiveSubtitleStyle();

  // Show first subtitle if ASS already generated
  if (previewSegments.length > 0) {
    const overlay = document.getElementById('liveSubtitleOverlay');
    if (overlay) overlay.textContent = previewSegments[0].text;
  }

  console.log('[preview] BG video loaded into live preview.');
}

/* ------------------------------------------------------------------
   APPLY SUBTITLE STYLE TO OVERLAY
   ------------------------------------------------------------------ */
function applyLiveSubtitleStyle() {
  const overlay = document.getElementById('liveSubtitleOverlay');
  if (!overlay) return;

  const color = document.getElementById('subtitleColor')?.value || '#ffffff';
  const outline = document.getElementById('outlineColor')?.value || '#000000';
  const size = document.getElementById('fontSizeSlider')?.value || '22';
  const position = document.getElementById('subtitlePosition')?.value || '2';

  overlay.style.color = color;
  overlay.style.fontSize = `${size}px`;
  overlay.style.textShadow = `2px 2px 5px ${outline}, -1px -1px 3px ${outline}`;

  if (position === '8') {
    overlay.style.top = '5%';
    overlay.style.bottom = 'auto';
    overlay.style.transform = 'translateX(-50%)';
  } else if (position === '5') {
    overlay.style.top = '50%';
    overlay.style.bottom = 'auto';
    overlay.style.transform = 'translate(-50%, -50%)';
  } else {
    overlay.style.bottom = '5%';
    overlay.style.top = 'auto';
    overlay.style.transform = 'translateX(-50%)';
  }
}

/* ------------------------------------------------------------------
   PLAYBACK
   ------------------------------------------------------------------ */
function togglePlay() {
  if (!previewAudio) return;

  const vid = document.getElementById('livePreviewVideo');

  if (previewAudio.paused) {
    previewAudio.play();
    vid?.play().catch(() => { });
    document.getElementById('livePlayBtn').textContent = '⏸ Pause';
    animFrame = requestAnimationFrame(updateLoop);
  } else {
    previewAudio.pause();
    vid?.pause();
    document.getElementById('livePlayBtn').textContent = '▶ Play';
    cancelAnimationFrame(animFrame);
  }
}

function onEnded() {
  document.getElementById('livePlayBtn').textContent = '▶ Play';
  document.getElementById('livePreviewProgress').style.width = '100%';
  cancelAnimationFrame(animFrame);
  document.getElementById('livePreviewVideo')?.pause();
}

function updateLoop() {
  if (!previewAudio || previewAudio.paused) return;
  updateDisplay();
  animFrame = requestAnimationFrame(updateLoop);
}

function updateDisplay() {
  const currentMs = previewAudio.currentTime * 1000;
  const total = totalDuration || 1;

  let activeIndex = -1;
  for (let i = previewSegments.length - 1; i >= 0; i--) {
    if (currentMs >= previewSegments[i].start_ms) { activeIndex = i; break; }
  }

  if (activeIndex !== lastSegIndex && activeIndex >= 0) {
    lastSegIndex = activeIndex;
    const overlay = document.getElementById('liveSubtitleOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.textContent = previewSegments[activeIndex].text;
        overlay.style.opacity = '1';
      }, 150);
    }
  }

  document.getElementById('livePreviewProgress').style.width =
    `${Math.min(100, (currentMs / total) * 100)}%`;
  document.getElementById('livePreviewTime').textContent =
    `${formatTime(currentMs / 1000)} / ${formatTime(total / 1000)}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}