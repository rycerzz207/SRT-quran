import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import sys, os
import tempfile
import subprocess
import shutil
from pathlib import Path

# Ensure local imports work when the script is executed from its own directory
sys.path.insert(0, os.path.dirname(__file__))
from transcribe import transcribe_audio

app = FastAPI(title="Quran SRT Backend")

# CORS configuration – allow requests from the local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    print("[server] Health check called")
    return {"status": "running", "message": "Quran SRT Backend is up."}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    print(f"[server] Received file: {file.filename} ({file.content_type})")

    # Validate file type
    allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4"]
    if file.content_type not in allowed:
        print(f"[server] Rejected file type: {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use MP3, WAV, or OGG."
        )

    # Read file bytes
    file_bytes = await file.read()
    print(f"[server] File size: {len(file_bytes)} bytes")

    if len(file_bytes) == 0:
        print("[server] ERROR: Empty file received")
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Determine extension (default to .mp3 if missing)
    ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ".mp3"

    # Perform transcription
    result = transcribe_audio(file_bytes, ext)

    if not result["success"]:
        print(f"[server] Transcription failed: {result['error']}")
        raise HTTPException(status_code=500, detail=result["error"])

    print(f"[server] Transcription successful. Words: {result['word_count']}")
    return result


# Render endpoint – combines video, audio and subtitles via ffmpeg
def hex_to_ffmpeg_color(hex_color: str) -> str:
    """Convert a hex color like "#rrggbb" to ffmpeg ASS ABGR format.
    Returns like "&H00BBGGRR&" (uppercase) suitable for force_style.
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        # fallback to white if malformed
        hex_color = 'ffffff'
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"&H00{b}{g}{r}&".upper()

@app.post("/render")
async def render(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    audio: UploadFile = File(...),
    ass: UploadFile = File(...),
    mute_video: str = Form("false"),
    mode: str = Form("A"),
    font_size: str = Form("28"),
    auto_scale: str = Form("true"),
    subtitle_color: str = Form("#ffffff"),
    outline_color: str = Form("#000000"),
    subtitle_position: str = Form("2"),
):
    """Render a video with subtitles and optional audio mute.

    Parameters
    ----------
    background_tasks: FastAPI BackgroundTasks for cleanup.
    video, audio, ass: Uploaded files.
    mute_video: "true" to mute the video (no audio stream).
    mode: "A" for Amiri font, "B" for Arial font.
    """
    # Verify ffmpeg is available
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not found. Install ffmpeg and add it to PATH.")

    # Validate mode selection
    if mode not in ("A", "B"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'A' or 'B'.")

    # Create a temporary workspace for the uploaded assets
    tmpdir = tempfile.mkdtemp()
    background_tasks.add_task(shutil.rmtree, tmpdir, True)

    try:
        # Resolve absolute paths inside the temp directory
        video_path = Path(tmpdir) / video.filename
        audio_path = Path(tmpdir) / audio.filename
        ass_path   = Path(tmpdir) / ass.filename

        with open(video_path, "wb") as f:
            f.write(await video.read())
        with open(audio_path, "wb") as f:
            f.write(await audio.read())
        with open(ass_path, "wb") as f:
            f.write(await ass.read())

        # Determine subtitle styling based on the selected mode and user preferences
        # Parse user-provided values
        try:
            user_font_size = int(font_size)
        except Exception:
            user_font_size = 28
        auto_scale_flag = auto_scale.lower() == "true"
        # Probe video resolution for auto‑scale if requested
        final_font_size = user_font_size
        if auto_scale_flag:
            try:
                probe = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=width,height",
                     "-of", "csv=p=0", video_path],
                    capture_output=True, text=True, check=True)
                width, height = map(int, probe.stdout.strip().split(','))
                base_height = 1920
                scale_factor = height / base_height
                final_font_size = max(16, int(user_font_size * scale_factor))
                print(f"[render] Auto‑scaled font size to {final_font_size} based on video height {height}")
            except Exception as e:
                print(f"[render] Auto‑scale failed: {e}, using original font size {user_font_size}")
        ass_path_str = str(ass_path).replace('\\', '/')
        ass_escaped  = ass_path_str.replace(':', '\\:')

        if mode == "A":
            # Use embedded ASS style as-is — font, color, size all come from the file
            subtitle_filter = f"ass='{ass_escaped}'"
        else:
            # Mode B — apply user UI controls via force_style
            alignment = int(subtitle_position) if subtitle_position.isdigit() else 2
            force_style = (
                f"FontName=Arial,FontSize={final_font_size},Alignment={alignment},"
                f"PrimaryColour={hex_to_ffmpeg_color(subtitle_color)},OutlineColour={hex_to_ffmpeg_color(outline_color)},"
                "Outline=2,Shadow=1,MarginV=50"
            )
            subtitle_filter = f"subtitles='{ass_escaped}':force_style='{force_style}'"

        output_path = Path(tmpdir) / "output.mp4"

        # Build ffmpeg command
        cmd = [
            "ffmpeg",
            "-stream_loop", "-1",
            "-i", str(video_path),
            "-i", str(audio_path),
        ]

        # If muting video, map only video and the new audio stream
        if mute_video.lower() == "true":
            cmd.extend(["-map", "0:v", "-map", "1:a"])

        cmd.extend([
            "-vf", subtitle_filter,
            "-shortest",
            "-y",
            str(output_path),
        ])

        print(f"[render] Running ffmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=result.stderr.decode())

        # Return the generated video to the client
        return FileResponse(path=output_path, media_type="video/mp4", filename="reel_output.mp4")
    except Exception as e:
        print(f"[render] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("[server] Starting Quran SRT Backend on http://localhost:8001")
    print("[server] Frontend should be running on http://localhost:8000")
    print("[server] Press CTRL+C to stop")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")