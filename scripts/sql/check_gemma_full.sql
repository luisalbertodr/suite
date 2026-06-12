SELECT 'overrides' AS section, c.name, p.resource, p.action, upo.mode::text
FROM public.user_permission_overrides upo
JOIN auth.users u ON u.id = upo.user_id
JOIN public.companies c ON c.id = upo.company_id
JOIN public.permissions p ON p.id = upo.permission_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com' AND p.resource = 'marketing'
UNION ALL
SELECT 'active', c.name, '', '', uac.company_id::text
FROM public.user_active_company uac
JOIN auth.users u ON u.id = uac.user_id
JOIN public.companies c ON c.id = uac.company_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
UNION ALL
SELECT 'eff_active', ep.resource, ep.action, '', ''
FROM auth.users u
CROSS JOIN LATERAL public.get_effective_user_permissions(u.id, NULL::uuid) ep
WHERE u.email = 'gemmasuarezgonzalez@gmail.com' AND ep.resource = 'marketing'
UNION ALL
SELECT 'has_perm', 'read', user_has_effective_permission(u.id,'marketing','read')::text, 'write', user_has_effective_permission(u.id,'marketing','write')::text
FROM auth.users u WHERE u.email = 'gemmasuarezgonzalez@gmail.com';
