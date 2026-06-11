import os
import tempfile
from faster_whisper import WhisperModel

print("[transcribe] Loading Whisper base model...")
model = WhisperModel(
    "C:\\Program Files (x86)\\Kiddo\\quran reel maker\\backend\\models\\small",
    device="cpu",
    compute_type="int8"
)
print("[transcribe] Model loaded.")

def transcribe_audio(file_bytes: bytes, file_ext: str = ".mp3") -> dict:
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    print(f"[transcribe] Saved to: {tmp_path}")
    try:
        print("[transcribe] Transcribing...")
        segments, info = model.transcribe(
            tmp_path,
            language="ar",
            word_timestamps=True,
            beam_size=5
        )
        print(f"[transcribe] Language: {info.language} ({info.language_probability:.2f})")
        words = []
        for segment in segments:
            print(f"[transcribe] {segment.start:.2f}s -> {segment.end:.2f}s | {segment.text.strip()}")
            if segment.words:
                for w in segment.words:
                    words.append({
                        "word": w.word.strip(),
                        "start_ms": int(w.start * 1000),
                        "end_ms": int(w.end * 1000)
                    })
        print(f"[transcribe] Done. {len(words)} words.")
        return {
            "success": True,
            "language": info.language,
            "word_count": len(words),
            "words": words
        }
    except Exception as e:
        print(f"[transcribe] ERROR: {e}")
        return {
            "success": False,
            "error": str(e),
            "words": []
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"[transcribe] Cleaned up: {tmp_path}")
