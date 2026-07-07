SELECT count(*) AS mapped_cash_sessions
FROM dunasoft.style_sync_entity_map
WHERE entity_type = 'cash_session'
  AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
