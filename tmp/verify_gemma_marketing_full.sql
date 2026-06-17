-- Verificación completa Gemma: acceso marketing + simulación RPC

\echo '=== Usuario ==='
SELECT u.id, u.email, up.company_id AS profile_company, uac.company_id AS active_company
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
LEFT JOIN public.user_active_company uac ON uac.user_id = u.id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com';

\echo '=== Roles por empresa ==='
SELECT c.name, r.name AS role
FROM public.user_company_roles ucr
JOIN auth.users u ON u.id = ucr.user_id
JOIN public.companies c ON c.id = ucr.company_id
JOIN public.roles r ON r.id = ucr.role_id
WHERE u.email = 'gemmasuarezgonzalez@gmail.com'
ORDER BY c.name;

\echo '=== RPC marketing write (user explícito) ==='
SELECT public.current_user_has_marketing_permission('write', u.id) AS can_write,
       public.current_user_has_marketing_permission('read', u.id) AS can_read
FROM auth.users u
WHERE u.email = 'gemmasuarezgonzalez@gmail.com';

\echo '=== user_can_access_company (marketing host 5d72...) ==='
SELECT public.user_can_access_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS as_current_user;

\echo '=== user_can_access_company para Gemma ==='
SELECT public.user_can_access_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, u.id) AS medicina,
       public.user_can_access_company('816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid, u.id) AS estetica
FROM auth.users u
WHERE u.email = 'gemmasuarezgonzalez@gmail.com';

\echo '=== Rol recepcion: permisos marketing en role_permissions ==='
SELECT p.resource, p.action
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name = 'recepcion' AND p.resource = 'marketing';

\echo '=== Leads count accesibles (host company) ==='
SELECT COUNT(*) FROM public.marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL;

\echo '=== Stages count ==='
SELECT COUNT(*) FROM public.marketing_lead_stages
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
