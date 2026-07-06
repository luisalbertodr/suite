"""Verifica que el adapter.js no tenga SyntaxError."""
import subprocess
r = subprocess.run(['node', '--check', '/app/dist/engine/adapters/whatsapp-web-js.adapter.js'],
                   capture_output=True, text=True)
if r.returncode == 0:
    print("JS syntax: OK")
else:
    print(f"JS syntax: ERROR")
    print(r.stderr[:500])
# Verificar parches
src = open('/app/dist/engine/adapters/whatsapp-web-js.adapter.js').read()
checks = {
    'protocolTimeout=120000': 'protocolTimeout: 120000' in src,
    'sendAudioAsVoice': 'sendAudioAsVoice: true' in src,
    'OpusHead': 'OpusHead' in src,
}
for k, v in checks.items():
    print(f'  {k}: {"OK" if v else "NOT FOUND"}')