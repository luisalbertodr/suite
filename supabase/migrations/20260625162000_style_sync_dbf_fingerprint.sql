-- Huellas DBF para detectar cambios sin depender de cola_sincro (hooks en forms).
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_dbf_fingerprint (
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tabla        text NOT NULL,
  style_key    text NOT NULL,
  fingerprint  text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, tabla, style_key)
);

CREATE INDEX IF NOT EXISTS style_sync_dbf_fp_tabla_idx
  ON dunasoft.style_sync_dbf_fingerprint (company_id, tabla);

ALTER TABLE dunasoft.style_sync_cursor
  ADD COLUMN IF NOT EXISTS dbf_baseline_seeded boolean NOT NULL DEFAULT false;

COMMENT ON TABLE dunasoft.style_sync_dbf_fingerprint IS
  'Huella por registro DBF; el agente compara para detectar cambios sin cola_sincro.';

GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_dbf_fingerprint TO service_role;
