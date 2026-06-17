\set uid 'c3017f22-b618-4244-bbae-a578f8f22730'

\echo '=== Effective permissions Estética ==='
SELECT resource, action FROM public.get_effective_user_permissions(:'uid'::uuid, '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid)
WHERE resource = 'marketing';

\echo '=== Effective permissions Medicina ==='
SELECT resource, action FROM public.get_effective_user_permissions(:'uid'::uuid, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)
WHERE resource = 'marketing';

\echo '=== User permission overrides ==='
SELECT c.name, p.resource, p.action, upo.effect
FROM public.user_permission_overrides upo
JOIN public.permissions p ON p.id = upo.permission_id
JOIN public.companies c ON c.id = upo.company_id
WHERE upo.user_id = :'uid'::uuid AND p.resource = 'marketing';

\echo '=== Accessible companies (simulate auth.uid) ==='
SELECT set_config('request.jwt.claim.sub', :'uid', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.user_can_access_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS medicina,
       public.user_can_access_company('816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid) AS estetica;

\echo '=== get_user_accessible_company_ids ==='
SELECT * FROM public.get_user_accessible_company_ids();

\echo '=== RPC marketing write with auth.uid sim ==='
SELECT public.current_user_has_marketing_permission('write') AS rpc_write;
