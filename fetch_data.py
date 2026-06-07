import requests, json, os, time

os.makedirs('data/timings', exist_ok=True)

# --- surahs.json ---
print("Fetching surahs...")
r = requests.get('https://api.quran.com/api/v4/chapters?language=en')
chapters = r.json()['chapters']
surahs = [{"id": c["id"], "name_arabic": c["name_arabic"],
           "name_english": c["name_simple"], "verses_count": c["verses_count"]}
          for c in chapters]
with open('data/surahs.json', 'w', encoding='utf-8') as f:
    json.dump(surahs, f, ensure_ascii=False)
print("Saved surahs.json")

# --- verses.json ---
print("Fetching verses (114 surahs)...")
all_verses = {}
for s in range(1, 115):
    try:
        r = requests.get(f'https://api.quran.com/api/v4/verses/by_chapter/{s}?words=true&word_fields=text_uthmani&per_page=300')
        verses = r.json()['verses']
        all_verses[str(s)] = [{"verse_number": v["verse_number"],
                                "words": [w["text_uthmani"] for w in v["words"]
                                          if w.get("char_type_name") != "end"]}
                               for v in verses]
        print(f"  Surah {s}/114")
        time.sleep(0.5)
    except Exception as e:
        print(f"  Surah {s} failed: {e}")
with open('data/verses.json', 'w', encoding='utf-8') as f:
    json.dump(all_verses, f, ensure_ascii=False)
print("Saved verses.json")

# --- timings ---
RECITERS = [
    {"file": "mishary",    "recitation_id": 7},
    {"file": "sudais",     "recitation_id": 5},
    {"file": "husary",     "recitation_id": 3},
    {"file": "minshawi",   "recitation_id": 4},
    {"file": "saad",       "recitation_id": 9},
    {"file": "abdulbasit", "recitation_id": 2},
]
for rec in RECITERS:
    print(f"Fetching timings: {rec['file']}...")
    timing_data = {}

    for s in range(1, 115):
        try:
            r = requests.get(
                f'https://api.quran.com/api/v4/recitations/{rec["recitation_id"]}/by_chapter/{s}'
            )

            audio_files = r.json().get('audio_files', [])

            timing_data[str(s)] = []

            for af in audio_files:
                verse_num = int(af['verse_key'].split(':')[1])

                raw_segments = af.get('segments')

                segs = []

                if raw_segments and isinstance(raw_segments, list):
                    for seg in raw_segments:
                        # defensive parsing
                        if isinstance(seg, list) and len(seg) >= 4:
                            segs.append({
                                "word_index": seg[0],
                                "start_ms": int(float(seg[2]) * 1000),
                                "end_ms": int(float(seg[3]) * 1000)
                            })

                timing_data[str(s)].append({
                    "verse_number": verse_num,
                    "segments": segs
                })

            print(f"  {rec['file']} surah {s}/114")
            time.sleep(0.5)

        except Exception as e:
            print(f"  {rec['file']} surah {s} failed: {e}")