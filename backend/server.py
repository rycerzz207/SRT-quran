import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import sys, os
import tempfile
import subprocess
import shutil
from pathlib import Path
sys.path.insert(0, os.path.dirname(__file__))
from transcribe import transcribe_audio

app = FastAPI(title="Quran SRT Backend")

# Allow requests from the frontend (localhost:8000)
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

    # Get file extension from filename
    ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ".mp3"

    # Transcribe
    result = transcribe_audio(file_bytes, ext)

    if not result["success"]:
        print(f"[server] Transcription failed: {result['error']}")
        raise HTTPException(status_code=500, detail=result["error"])

    print(f"[server] Transcription successful. Words: {result['word_count']}")
    return result

# Render endpoint implementation (updated)
@app.post("/render")
async def render(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    audio: UploadFile = File(...),
    srt: UploadFile = File(...),
    mute_video: str = Form("false"),
    mode: str = Form("A"),
):
    """Render a video with subtitles and optional audio mute.

    Parameters
    ----------
    background_tasks: FastAPI BackgroundTasks for cleanup.
    video, audio, srt: Uploaded files.
    mute_video: "true" to mute the video (no audio stream).
    mode: "A" for Amiri font, "B" for Arial font.
    """
    # Ensure ffmpeg is available
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg not found. Install ffmpeg and add it to PATH.")

    # Validate mode
    if mode not in ("A", "B"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'A' or 'B'.")

    # Create a temporary directory for processing
    tmpdir = tempfile.mkdtemp()
    # Schedule cleanup after response is sent
    background_tasks.add_task(shutil.rmtree, tmpdir, True)

    try:
        # Paths for uploaded files
        video_path = Path(tmpdir) / video.filename
        audio_path = Path(tmpdir) / audio.filename
        srt_path = Path(tmpdir) / srt.filename

        # Save uploaded files
        with open(video_path, "wb") as f:
            f.write(await video.read())
        with open(audio_path, "wb") as f:
            f.write(await audio.read())
        with open(srt_path, "wb") as f:
            f.write(await srt.read())

        # Choose subtitle style based on mode
        if mode == "A":
            font_name = "Amiri"
            font_size = 28
        else:
            font_name = "Arial"
            font_size = 24
        # Escape Windows path for ffmpeg subtitles filter
        srt_escaped = str(srt_path).replace('\\', '\\\\').replace(':', '\\:')
        subtitle_filter = (
            f"subtitles='{srt_escaped}':force_style='FontName={font_name},FontSize={font_size},"
            f"Alignment=2,PrimaryColour=&H00FFFFFF'"
        )

        output_path = Path(tmpdir) / "output.mp4"

        # Build ffmpeg command
        cmd = [
            "ffmpeg",
            "-stream_loop", "-1",
            "-i", str(video_path),
            "-i", str(audio_path),
        ]
        # If muting video, map streams accordingly
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

        # Return the rendered video file
        return FileResponse(path=output_path, media_type="video/mp4", filename="reel_output.mp4")
    except Exception as e:
        print(f"[render] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("[server] Starting Quran SRT Backend on http://localhost:8001")
    print("[server] Frontend should be running on http://localhost:8000")
    print("[server] Press CTRL+C to stop")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
