SELECT c.name, p.resource, p.action, upo.mode
FROM public.user_permission_overrides upo
JOIN auth.users u ON u.id = upo.user_id
JOIN public.companies c ON c.id = upo.company_id
JOIN public.permissions p ON p.id = upo.permission_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
  AND p.resource = 'marketing'
ORDER BY c.name, p.action;

SELECT c.name AS active_company
FROM public.user_active_company uac
JOIN auth.users u ON u.id = uac.user_id
JOIN public.companies c ON c.id = uac.company_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com';
