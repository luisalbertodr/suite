from pathlib import Path
import re

path = Path("/root/supabase-project/docker-compose.yml")
text = path.read_text(encoding="utf-8")
keys = [
    "SERVICE_MONITOR_CRON_SECRET",
    "SPA3102_PASSWORD",
    "SPA3102_USERNAME",
    "SPA3102_BASE_URL",
    "ISSABEL_CDR_URL",
    "ISSABEL_API_TOKEN",
    "ISSABEL_INTERNAL_EXTENSIONS_REGEX",
]
for key in keys:
    want = f"      {key}: ${{{key}}}"
    pattern = re.compile(rf"^(\s+{re.escape(key)}:\s*).*$", re.M)
    if pattern.search(text):
        text = pattern.sub(want, text, count=1)
    else:
        print(f"missing key in compose: {key}")
path.write_text(text, encoding="utf-8")
print("compose fixed")
