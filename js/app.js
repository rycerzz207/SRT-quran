// app.js: Application entry point – initialization and event wiring
import { populateReciters, fetchSurahs, setupListeners, updateAudioPreview, surahChanged, setStatus } from './ui.js';
import { generateSRT, downloadLastSRT } from './srt.js';

document.getElementById('downloadBtn').addEventListener('click', downloadLastSRT);

(async () => {
  try {
    // Show ready status
    setStatus('Ready.');
    // Populate reciter selector
    populateReciters();
    // Load surahs and populate dropdown
    await fetchSurahs();
    // Set initial audio preview (will use default selections)
    updateAudioPreview();
    // Set up UI event listeners
    setupListeners();
  } catch (err) {
    console.error('Initialization error:', err);
    setStatus('Initialization failed: ' + err.message, true);
    document.getElementById('downloadBtn').addEventListener('click', () => {
      if (lastSRTContent) downloadSRT(lastSRTContent, lastSRTFilename);
    });
  }
})();