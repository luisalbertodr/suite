SELECT session_date, closing_cash, expected_cash, expected_card, counted_cash, counted_card, left(notes,40) notes
FROM public.cash_register_sessions
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY session_date DESC LIMIT 12;
