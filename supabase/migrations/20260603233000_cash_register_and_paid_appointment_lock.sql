-- ============================================================================
-- Caja diaria y bloqueo de citas cobradas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Bloqueo defensivo de citas con ticket completado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.appointment_has_completed_sale(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.appointment_id = p_appointment_id
      AND s.status = 'completed'
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_paid_appointment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.appointment_has_completed_sale(OLD.id) THEN
    RAISE EXCEPTION 'No se puede eliminar una cita cobrada; cancélala para dejar constancia.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_appointment_delete ON public.agenda_appointments;
CREATE TRIGGER trg_prevent_paid_appointment_delete
BEFORE DELETE ON public.agenda_appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_appointment_delete();

CREATE OR REPLACE FUNCTION public.prevent_paid_appointment_restricted_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.appointment_has_completed_sale(OLD.id) THEN
    IF
      NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
      NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
      NEW.title IS DISTINCT FROM OLD.title OR
      NEW.client_name IS DISTINCT FROM OLD.client_name OR
      NEW.start_time IS DISTINCT FROM OLD.start_time OR
      NEW.end_time IS DISTINCT FROM OLD.end_time OR
      NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
    THEN
      RAISE EXCEPTION 'No se pueden modificar fecha, hora, cliente, empleada ni componentes de una cita cobrada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_appointment_restricted_update ON public.agenda_appointments;
CREATE TRIGGER trg_prevent_paid_appointment_restricted_update
BEFORE UPDATE ON public.agenda_appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_appointment_restricted_update();

CREATE OR REPLACE FUNCTION public.prevent_paid_appointment_items_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_appointment_id := NEW.appointment_id;
  ELSE
    v_appointment_id := OLD.appointment_id;
  END IF;
  IF v_appointment_id IS NOT NULL AND public.appointment_has_completed_sale(v_appointment_id) THEN
    RAISE EXCEPTION 'No se pueden modificar componentes de una cita cobrada.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_appointment_items_ins ON public.appointment_items;
DROP TRIGGER IF EXISTS trg_prevent_paid_appointment_items_upd ON public.appointment_items;
DROP TRIGGER IF EXISTS trg_prevent_paid_appointment_items_del ON public.appointment_items;
CREATE TRIGGER trg_prevent_paid_appointment_items_ins
BEFORE INSERT ON public.appointment_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_appointment_items_change();
CREATE TRIGGER trg_prevent_paid_appointment_items_upd
BEFORE UPDATE ON public.appointment_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_appointment_items_change();
CREATE TRIGGER trg_prevent_paid_appointment_items_del
BEFORE DELETE ON public.appointment_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_appointment_items_change();

-- ---------------------------------------------------------------------------
-- 2) Caja diaria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_center_id uuid REFERENCES public.work_centers(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid,
  opening_cash numeric(12,2) NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closed_by uuid,
  expected_cash numeric(12,2) NOT NULL DEFAULT 0,
  expected_card numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash numeric(12,2),
  counted_card numeric(12,2),
  withdrawn_cash numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash numeric(12,2),
  cash_difference numeric(12,2),
  card_difference numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.cash_register_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('withdrawal', 'cash_in', 'adjustment')),
  payment_channel text NOT NULL DEFAULT 'cash' CHECK (payment_channel IN ('cash', 'card')),
  amount numeric(12,2) NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_company_date
  ON public.cash_register_sessions(company_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_register_movements_session
  ON public.cash_register_movements(session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_cash_register_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_register_sessions_updated_at ON public.cash_register_sessions;
CREATE TRIGGER trg_cash_register_sessions_updated_at
BEFORE UPDATE ON public.cash_register_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_cash_register_updated_at();

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_register_sessions_select ON public.cash_register_sessions;
CREATE POLICY cash_register_sessions_select
ON public.cash_register_sessions FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

DROP POLICY IF EXISTS cash_register_sessions_insert ON public.cash_register_sessions;
CREATE POLICY cash_register_sessions_insert
ON public.cash_register_sessions FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

DROP POLICY IF EXISTS cash_register_sessions_update ON public.cash_register_sessions;
CREATE POLICY cash_register_sessions_update
ON public.cash_register_sessions FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id))
WITH CHECK (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

DROP POLICY IF EXISTS cash_register_movements_select ON public.cash_register_movements;
CREATE POLICY cash_register_movements_select
ON public.cash_register_movements FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

DROP POLICY IF EXISTS cash_register_movements_insert ON public.cash_register_movements;
CREATE POLICY cash_register_movements_insert
ON public.cash_register_movements FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

DROP POLICY IF EXISTS cash_register_movements_update ON public.cash_register_movements;
CREATE POLICY cash_register_movements_update
ON public.cash_register_movements FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id))
WITH CHECK (company_id = public.get_user_company_id() OR public.company_in_user_work_center(company_id));

-- Permisos visibles/asignables desde gestión de usuarios.
INSERT INTO public.permissions (resource, action, name) VALUES
  ('cash_register', 'read', 'Ver cierre de caja'),
  ('cash_register', 'write', 'Gestionar cierre de caja')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'user'
  AND p.resource = 'cash_register'
  AND p.action IN ('read', 'write')
ON CONFLICT DO NOTHING;
