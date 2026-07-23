SELECT name, height_cm, birth_date,
       EXTRACT(YEAR FROM age(coalesce(birth_date::timestamp, now())))::int AS age_approx
FROM customers
WHERE name ILIKE '%Gemma Suarez%'
LIMIT 3;

SELECT status, height_cm, age_years, sex, created_at
FROM scale_weigh_requests
WHERE created_at > now() - interval '6 hours'
ORDER BY created_at DESC
LIMIT 5;
