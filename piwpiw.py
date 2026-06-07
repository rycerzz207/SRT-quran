import requests, json

r = requests.get('https://api.quran.com/api/v4/recitations/7/by_chapter/1')
data = r.json()
print(json.dumps(data['audio_files'][0], indent=2, ensure_ascii=False))