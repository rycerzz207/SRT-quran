# Prompt 5.1 — Visual Controls

Add three visual subtitle controls to the render UI. Do not touch `transcribe.py`, `srt.js`, `preview.js`, or the `/transcribe` endpoint.

### `index.html`
Inside `#videoUploadSection`, add these controls after the subtitle position selector:

```html
<div id="subtitleControls">
  <label for="fontSizeSlider">Subtitle font size: <span id="fontSizeValue">28</span>px</label>
  <input type="range" id="fontSizeSlider" min="16" max="72" value="28" step="2" />

  <label>
    <input type="checkbox" id="autoScaleFont" checked /> Auto-scale font to video resolution
  </label>

  <label for="subtitleColor">Subtitle color</label>
  <input type="color" id="subtitleColor" value="#ffffff" />

  <label for="outlineColor">Outline color</label>
  <input type="color" id="outlineColor" value="#000000" />
</div>
```

### `js/ui.js`
Inside `setupListeners()`, add:

```js
document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
  document.getElementById('fontSizeValue').textContent = e.target.value;
});
```

### `js/app.js`
In `renderVideo()`, read the new values and append to FormData:

```js
const autoScale     = document.getElementById('autoScaleFont').checked;
const fontSize      = document.getElementById('fontSizeSlider').value;
const subtitleColor = document.getElementById('subtitleColor').value;
const outlineColor  = document.getElementById('outlineColor').value;

formData.append('font_size',      fontSize);
formData.append('auto_scale',     autoScale ? 'true' : 'false');
formData.append('subtitle_color', subtitleColor);
formData.append('outline_color',  outlineColor);
```

### `backend/server.py`
Add new form fields to the `/render` signature:

```python
font_size: str = Form("28"),
auto_scale: str = Form("true"),
subtitle_color: str = Form("#ffffff"),
outline_color: str = Form("#000000"),
```

Add a helper function to convert hex color to ffmpeg ABGR format:

```python
def hex_to_ffmpeg_color(hex_color: str) -> str:
    hex_color = hex_color.lstrip('#')
    r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
    return f"&H00{b}{g}{r}&".upper()
```

Auto-scale logic — probe video resolution before rendering:

```python
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height",
     "-of", "csv=p=0", video_path],
    capture_output=True, text=True
)
width, height = map(int, probe.stdout.strip().split(','))
base_height = 1920
if auto_scale == "true":
    scale_factor = height / base_height
    final_font_size = max(16, int(int(font_size) * scale_factor))
else:
    final_font_size = int(font_size)
```

Use `final_font_size`, `hex_to_ffmpeg_color(subtitle_color)`, and `hex_to_ffmpeg_color(outline_color)` when building the force_style string for both Mode A and Mode B.

Console log prefix `[render]` for all new logs.
