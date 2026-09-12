
"""
ElevenLabs hesabindaki butun sesleri qisa formada gosterir.
Istifade: python3 list_voices.py SENIN_API_ACARIN
"""

import sys
import json
import urllib.request

if len(sys.argv) < 2:
    print("İstifadə: python3 list_voices.py SENIN_API_ACARIN")
    sys.exit(1)

api_key = sys.argv[1]

req = urllib.request.Request(
    "https://api.elevenlabs.io/v1/voices",
    headers={"xi-api-key": api_key},
)

with urllib.request.urlopen(req) as res:
    data = json.load(res)

voices = data.get("voices", [])

print(f"\nCəmi {len(voices)} səs tapıldı:\n")
print(f"{'CATEGORY':12} | {'OWNER':6} | {'VOICE_ID':22} | NAME")
print("-" * 70)

for v in voices:
    category = str(v.get("category", "?"))
    owner = str(v.get("is_owner", "?"))
    voice_id = v.get("voice_id", "?")
    name = v.get("name", "?")
    print(f"{category:12} | {owner:6} | {voice_id:22} | {name}")

print("\n👉 owner=True olan (xüsusilə category=premade) bir voice_id seç, ən etibarlısı budur.\n")
