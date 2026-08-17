-- PostgREST ejecuta RPCs STABLE en transacción read-only.
-- Estas funciones llaman a incentive_ensure_settings(), que hace INSERT
-- y devolvía HTTP 405 / 25006: "cannot execute INSERT in a read-only transaction".

ALTER FUNCTION public.incentive_board_team(uuid) VOLATILE;
ALTER FUNCTION public.incentive_employee_board_row(uuid, uuid) VOLATILE;
ALTER FUNCTION public.incentive_my_summary(uuid) VOLATILE;
ALTER FUNCTION public.incentive_admin_overview(uuid) VOLATILE;

NOTIFY pgrst, 'reload schema';
