SHOW statement_timeout;
SET ROLE authenticator;
SHOW statement_timeout;
RESET ROLE;

SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticator', 'postgres', 'anon', 'authenticated');
