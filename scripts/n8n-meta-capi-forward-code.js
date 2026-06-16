const EXPECTED = 'suite-meta-lipoout-2026';
const item = $input.first().json;
const headers = item.headers || {};
const secret = headers['x-suite-secret'] || headers['X-Suite-Secret'] || '';
if (EXPECTED && secret !== EXPECTED) {
  throw new Error('Webhook secret invalido');
}
const body = item.body ?? item;
if (body.capi_payload) {
  return [{ json: body.capi_payload }];
}
throw new Error('Falta capi_payload (Suite debe enviar el payload CAPI hasheado)');
