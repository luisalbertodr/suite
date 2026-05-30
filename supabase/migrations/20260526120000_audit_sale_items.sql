-- Auditoría en líneas de ticket TPV (insert/update/delete).

DO $$
BEGIN
  IF to_regclass('public.sale_items') IS NULL
     OR to_regprocedure('public.audit_log_row_change()') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS tr_audit_sale_items ON public.sale_items;
  CREATE TRIGGER tr_audit_sale_items
    AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change();
END
$$;
