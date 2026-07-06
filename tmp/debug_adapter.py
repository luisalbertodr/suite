"""Debug: muestra líneas 1030-1045 del adapter para ver el error."""
src = open('/app/dist/engine/adapters/whatsapp-web-js.adapter.js').read()
lines = src.split('\n')
for i in range(max(0, 1025), min(len(lines), 1050)):
    print(f'{i}: {lines[i]}')