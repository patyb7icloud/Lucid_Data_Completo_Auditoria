import json
import os

transcript_path = r"C:\Users\patyb\.gemini\antigravity-ide\brain\c0ab5de6-a87f-4940-9321-f9f7eb016f70\.system_generated\logs\transcript.jsonl"
output_path = r"C:\Users\patyb\.gemini\antigravity-ide\brain\c0ab5de6-a87f-4940-9321-f9f7eb016f70\scratch\search_results.txt"

terms = ["8 erros", "audit", "readiness", "critical", "sso", "rate-limiting", "caddy"]

results = []
if os.path.exists(transcript_path):
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if any(term in line.lower() for term in terms):
                try:
                    data = json.loads(line)
                    content = data.get("content") or ""
                    tool_calls = data.get("tool_calls") or []
                    if content or tool_calls:
                        results.append({
                            "type": data.get("type"),
                            "content": content[:2000] if content else "",
                            "tool_calls": str(tool_calls)[:1000] if tool_calls else ""
                        })
                except Exception as e:
                    pass

with open(output_path, "w", encoding="utf-8") as out:
    json.dump(results, out, indent=2, ensure_ascii=False)

print(f"Done! Found {len(results)} matches.")
