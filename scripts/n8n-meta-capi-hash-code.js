async function sha256(val) {
  if (!val) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto no disponible en n8n');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(val));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function normEmail(e) {
  return e ? String(e).trim().toLowerCase() : null;
}
function normPhone(p) {
  if (!p) return null;
  let d = String(p).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  return d || null;
}
function normName(n) {
  return n ? String(n).trim().toLowerCase() : null;
}
const EXPECTED = 'suite-meta-lipoout-2026';
const item = $input.first().json;
const headers = item.headers || {};
const secret = headers['x-suite-secret'] || headers['X-Suite-Secret'] || '';
if (EXPECTED && secret !== EXPECTED) {
  throw new Error('Webhook secret invalido');
}
const body = item.body ?? item;
const user_data = {};
const em = normEmail(body.email);
const ph = normPhone(body.phone);
const fn = normName(body.first_name);
const ln = normName(body.last_name);
const ext = body.external_id ? String(body.external_id) : null;
if (em) user_data.em = [await sha256(em)];
if (ph) user_data.ph = [await sha256(ph)];
if (fn) user_data.fn = [await sha256(fn)];
if (ln) user_data.ln = [await sha256(ln)];
if (ext) user_data.external_id = [await sha256(ext)];
const custom_data = {};
if (body.value != null && body.value !== '') custom_data.value = Number(body.value);
if (body.currency) custom_data.currency = String(body.currency).toUpperCase();
const event = {
  event_name: body.event_name,
  event_time: body.event_time || Math.floor(Date.now() / 1000),
  event_id: body.event_id,
  action_source: body.action_source || 'system_generated',
  user_data,
};
if (Object.keys(custom_data).length) event.custom_data = custom_data;
const payload = { data: [event] };
if (body.test_event_code) payload.test_event_code = body.test_event_code;
return [{ json: payload }];
