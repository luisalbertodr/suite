-- Reclasifica movimientos bancarios: exclusiones de gasto (traspasos / SL).

UPDATE public.bank_movements bm
SET
  is_contribution_return = (
    amount < 0
    AND translate(
      lower(bm.concept),
      'áéíóúüñ',
      'aeiouun'
    ) LIKE '%transferencia inmediata a favor de diaz rodriguez luis alberto%'
  ),
  is_expense = (
    amount < 0
    AND NOT (
      translate(lower(bm.concept), 'áéíóúüñ', 'aeiouun')
        LIKE '%transferencia inmediata a favor de diaz rodriguez luis alberto%'
      OR translate(lower(bm.concept), 'áéíóúüñ', 'aeiouun')
        LIKE '%transferencia inmediata a favor de delgado lamas medicina%'
      OR translate(lower(bm.concept), 'áéíóúüñ', 'aeiouun') ~ '\ytraspaso\y'
    )
  );
