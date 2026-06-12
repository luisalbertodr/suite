\echo '=== Overrides marketing ==='
SELECT c.name, p.resource, p.action, upo.mode
FROM public.user_permission_overrides upo
JOIN auth.users u ON u.id = upo.user_id
JOIN public.companies c ON c.id = upo.company_id
JOIN public.permissions p ON p.id = upo.permission_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
  AND p.resource = 'marketing'
ORDER BY c.name, p.action;

\echo '=== Active company ==='
SELECT c.name, uac.company_id
FROM public.user_active_company uac
JOIN auth.users u ON u.id = uac.user_id
JOIN public.companies c ON c.id = uac.company_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com';

\echo '=== Effective perms Estetica ==='
SELECT ep.resource, ep.action
FROM auth.users u
CROSS JOIN LATERAL public.get_effective_user_permissions(
  u.id, '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
) ep
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
  AND ep.resource = 'marketing';

\echo '=== Effective perms Medicina ==='
SELECT ep.resource, ep.action
FROM auth.users u
CROSS JOIN LATERAL public.get_effective_user_permissions(
  u.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
) ep
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
  AND ep.resource = 'marketing';

\echo '=== Effective perms active (1-arg) ==='
SELECT ep.resource, ep.action
FROM auth.users u
CROSS JOIN LATERAL public.get_effective_user_permissions(u.id) ep
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
  AND ep.resource = 'marketing';
