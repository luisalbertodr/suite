# Crea el workflow Suite → Meta CAPI en n8n (requiere N8N_API_KEY en env o parámetro).
param(
  [string] $N8nApiKey = $env:N8N_API_KEY,
  [string] $N8nBase = 'http://192.168.99.110:5678/api/v1',
  [string] $WebhookSecret = 'suite-meta-lipoout-2026',
  [string] $PixelId = '291687001692956',
  [string] $MetaAccessToken = $env:META_CAPI_ACCESS_TOKEN
)

if (-not $N8nApiKey) {
  Write-Error 'Define N8N_API_KEY o pasa -N8nApiKey'
  exit 1
}

$codeJs = @"
const crypto = require('crypto');
const EXPECTED = '$WebhookSecret';
const item = `$input.first().json;
const headers = item.headers || {};
const secret = headers['x-suite-secret'] || headers['X-Suite-Secret'] || '';
if (EXPECTED && secret !== EXPECTED) {
  throw new Error('Webhook secret invalido');
}
const body = item.body ?? item;
function sha256(v) {
  if (!v) return null;
  return crypto.createHash('sha256').update(v).digest('hex');
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
const user_data = {};
const em = normEmail(body.email);
const ph = normPhone(body.phone);
const fn = normName(body.first_name);
const ln = normName(body.last_name);
const ext = body.external_id ? String(body.external_id) : null;
if (em) user_data.em = [sha256(em)];
if (ph) user_data.ph = [sha256(ph)];
if (fn) user_data.fn = [sha256(fn)];
if (ln) user_data.ln = [sha256(ln)];
if (ext) user_data.external_id = [sha256(ext)];
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
"@

$metaToken = if ($MetaAccessToken) { $MetaAccessToken } else { 'PEGAR_TOKEN_EAA_DEL_SYSTEM_USER' }

$workflow = @{
  name = 'Suite → Meta CAPI'
  nodes = @(
    @{
      parameters = @{
        httpMethod = 'POST'
        path = 'suite-meta-conversion'
        responseMode = 'onReceived'
        options = @{}
      }
      id = 'webhook-suite-meta'
      name = 'Webhook Suite'
      type = 'n8n-nodes-base.webhook'
      typeVersion = 2
      position = @(0, 0)
      webhookId = 'suite-meta-conversion'
    }
    @{
      parameters = @{
        jsCode = $codeJs
      }
      id = 'code-hash-capi'
      name = 'Hash y payload CAPI'
      type = 'n8n-nodes-base.code'
      typeVersion = 2
      position = @(280, 0)
    }
    @{
      parameters = @{
        method = 'POST'
        url = "https://graph.facebook.com/v23.0/$PixelId/events"
        sendHeaders = $true
        headerParameters = @{
          parameters = @(
            @{
              name = 'Authorization'
              value = "Bearer $metaToken"
            }
          )
        }
        sendBody = $true
        specifyBody = 'json'
        jsonBody = '={{ JSON.stringify($json) }}'
        options = @{}
      }
      id = 'http-meta-capi'
      name = 'Meta CAPI events'
      type = 'n8n-nodes-base.httpRequest'
      typeVersion = 4.2
      position = @(560, 0)
    }
  )
  connections = @{
    'Webhook Suite' = @{
      main = @(
        @(
          @{
            node = 'Hash y payload CAPI'
            type = 'main'
            index = 0
          }
        )
      )
    }
    'Hash y payload CAPI' = @{
      main = @(
        @(
          @{
            node = 'Meta CAPI events'
            type = 'main'
            index = 0
          }
        )
      )
    }
  }
  settings = @{
    executionOrder = 'v1'
  }
}

$headers = @{
  'X-N8N-API-KEY' = $N8nApiKey
  'Content-Type' = 'application/json'
}

Write-Host 'Creando workflow...'
$created = Invoke-RestMethod -Method POST -Uri "$N8nBase/workflows" -Headers $headers -Body ($workflow | ConvertTo-Json -Depth 20)
$id = $created.id
Write-Host "Workflow id: $id"

Write-Host 'Activa el workflow manualmente en n8n (toggle Active).'
Write-Host 'La API activate de esta instancia falla con error interno; el webhook produccion requiere Active=ON.'
Write-Host 'Webhook: http://192.168.99.110:5678/webhook/suite-meta-conversion'
