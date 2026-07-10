# Prueba manual: PowerShell → n8n → Meta (payload CAPI hasheado en cliente).
param(
  [string] $WebhookUrl = 'http://192.168.99.110:5678/webhook/suite-meta-capi-lipoout',
  [string] $Secret = 'suite-meta-lipoout-2026',
  [string] $CompanyId = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4',
  [string] $TestEventCode = '',
  [string] $EventName = 'Lead'
)

function Sha256($s) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
  $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  -join ($hash | ForEach-Object { $_.ToString('x2') })
}

$epoch = [int][double]::Parse((Get-Date -UFormat %s))
$eventId = "manual-test-$(Get-Date -Format 'yyyyMMddHHmmss')"

$em = Sha256 'test@lipoout.com'
$ph = Sha256 '34600111222'
$fn = Sha256 'test'
$ln = Sha256 'suite'

$capiEvent = @{
  event_name = $EventName
  event_time = $epoch
  event_id = $eventId
  action_source = 'system_generated'
  user_data = @{
    em = @($em)
    ph = @($ph)
    fn = @($fn)
    ln = @($ln)
    lead_id = 1234567890123456
  }
  custom_data = @{
    event_source = 'crm'
    lead_event_source = 'Suite'
  }
}

$capiPayload = @{ data = @($capiEvent) }
if ($TestEventCode) { $capiPayload.test_event_code = $TestEventCode }

$body = @{
  company_id = $CompanyId
  event_name = $EventName
  event_id = $eventId
  capi_payload = $capiPayload
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "POST $WebhookUrl"
try {
  $resp = Invoke-WebRequest -Method POST -Uri $WebhookUrl `
    -Headers @{ 'Content-Type' = 'application/json'; 'X-Suite-Secret' = $Secret } `
    -Body $body -UseBasicParsing
  Write-Host "HTTP $($resp.StatusCode)"
  Write-Host $resp.Content
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
