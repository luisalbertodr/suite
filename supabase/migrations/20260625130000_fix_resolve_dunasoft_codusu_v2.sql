-- Producción: user_profiles solo tiene (id, user_id, company_id, employee_id, timestamps).
-- Sin display_name ni email.

CREATE OR REPLACE FUNCTION dunasoft.resolve_dunasoft_codusu(
  p_user_id uuid,
  p_company_id uuid,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codusu text;
BEGIN
  v_codusu := nullif(btrim(p_payload->>'codusu'), '');
  IF v_codusu IS NOT NULL THEN
    RETURN left(v_codusu, 15);
  END IF;

  SELECT left(
    coalesce(
      nullif(btrim(e.name), ''),
      nullif(split_part(coalesce(au.email::text, ''), '@', 1), ''),
      'SUITE'
    ),
    15
  )
  INTO v_codusu
  FROM public.user_profiles up
  LEFT JOIN public.agenda_employees e
    ON e.id = up.employee_id AND e.company_id = p_company_id
  LEFT JOIN auth.users au ON au.id = up.user_id
  WHERE up.user_id = p_user_id
    AND (up.company_id = p_company_id OR up.company_id IS NULL)
  ORDER BY CASE WHEN up.company_id = p_company_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN coalesce(v_codusu, 'SUITE');
END;
$$;
