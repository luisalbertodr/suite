"""
Parchea whatsapp-web-js.adapter.js para aumentar protocolTimeout de Puppeteer
y evitar "Runtime.callFunctionOn timed out" en getChats().

Ejecutar dentro del contenedor OpenWA:
  docker cp patch_getchats_timeout.py openwa:/tmp/
  docker exec openwa python3 /tmp/patch_getchats_timeout.py
  docker restart openwa
"""
from pathlib import Path

p = Path("/app/dist/engine/adapters/whatsapp-web-js.adapter.js")
src = p.read_text()

# 1. Aumentar protocolTimeout en launch() si existe
OLD_LAUNCH_TIMEOUT = "protocolTimeout"
if OLD_LAUNCH_TIMEOUT not in src:
    # Buscar la llamada a puppeteer.launch() y añadir protocolTimeout
    # Ejemplo: puppeteer_launch_1.default({...})
    import re
    # Buscar patrón: puppeteer.launch({ ... })
    launch_match = re.search(
        r'(puppeteer(?:_launch_\d+)?\.default\s*\(\s*\{)([^}]*)(\}\s*\))',
        src,
    )
    if launch_match:
        before = launch_match.group(1)
        middle = launch_match.group(2)
        after = launch_match.group(3)
        if "protocolTimeout" not in middle:
            # Añadir protocolTimeout antes del cierre
            if middle.strip():
                middle = middle.rstrip() + ",\n            protocolTimeout: 120000"
            else:
                middle = "\n            protocolTimeout: 120000\n        "
            new_launch = before + middle + after
            src = src[: launch_match.start()] + new_launch + src[launch_match.end() :]
            print("patched: protocolTimeout=120000 añadido a launch()")
else:
    print("protocolTimeout ya existe en launch()")

# 2. Parchear getChats para que tenga su propio timeout
# Buscar "async getChats()" y añadir un timeout de 120s
OLD_GETCHATS = "async getChats()"
NEW_GETCHATS = """async getChats(timeoutMs = 120000) {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getChats timed out after ' + timeoutMs + 'ms')), timeoutMs)
        );
        try {
            const result = await Promise.race([
                this.client.getChats(),
                timeoutPromise,
            ]);
            return result;
        } catch (err) {
            console.error('[getChats failed]', err.message);
            throw err;
        }
    }

    // keep-alive original (renamed)
    async getChats_original"""

if OLD_GETCHATS in src and "async getChats(timeoutMs" not in src:
    # Encontrar la definición exacta con su cuerpo
    import re as re2
    # Buscar "async getChats() {" hasta el siguiente "async " o el final del método
    match = re2.search(
        r'async getChats\(\)\s*\{',
        src,
    )
    if match:
        method_start = match.start()
        # Encontrar el balance de llaves
        depth = 0
        i = match.end() - 1
        while i < len(src):
            if src[i] == '{':
                depth += 1
            elif src[i] == '}':
                depth -= 1
                if depth == 0:
                    method_end = i + 1
                    break
            i += 1
        else:
            print("WARN: no se pudo encontrar el final de getChats()")
            method_end = match.end()

        # Solo parchear si el cuerpo actual es simple (solo un return/await)
        old_body = src[method_start:method_end]
        if "timeout" not in old_body.lower():
            new_body = NEW_GETCHATS
            src = src[:method_start] + new_body + src[method_end:]
            print("patched: getChats() con timeout de 120s")
else:
    print("getChats() ya parcheado o no encontrado")

p.write_text(src)
print("parche aplicado correctamente")