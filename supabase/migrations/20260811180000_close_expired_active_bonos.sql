-- Align active-bono semantics: expired + inactive are not "usable".
-- Soft-close Style orphans that still show estado=activo past fecha_vencimiento.

UPDATE public.bonos
SET
  estado = 'completado',
  updated_at = NOW()
WHERE estado = 'activo'
  AND fecha_vencimiento IS NOT NULL
  AND fecha_vencimiento::date < CURRENT_DATE
  AND COALESCE(sesiones_usadas, 0) < GREATEST(COALESCE(sesiones_totales, 0), 1);

COMMENT ON COLUMN public.bonos.estado IS
  'activo | completado | inactivo (Style baja/delete). Vigente UI: activo, remaining>0, no vencido.';
