-- Generate database documentation
\o /tmp/db_documentation.md

\echo '# PodcastFlow Database Documentation'
\echo ''
\echo 'Generated on: ' `date`
\echo ''

\echo '## Database Overview'
\echo ''

-- List schemas with table counts
\echo '### Schemas'
\echo ''
SELECT 
    n.nspname AS "Schema",
    COUNT(c.oid) AS "Tables",
    pg_size_pretty(SUM(pg_total_relation_size(c.oid))::bigint) AS "Total Size"
FROM pg_namespace n
JOIN pg_class c ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND c.relkind = 'r'
GROUP BY n.nspname
ORDER BY n.nspname;

\echo ''
\echo '## Table Structure by Schema'
\echo ''

-- Generate table documentation for each schema
\echo '### Public Schema Tables'
\echo ''
\d+ public.*

\echo ''
\echo '### Organization Schema Tables (org_podcastflow_pro)'
\echo ''
\d+ org_podcastflow_pro.*

\echo ''
\echo '### Organization Schema Tables (org_unfy)'
\echo ''
\d+ org_unfy.*

\echo ''
\echo '### Master Schema Tables'
\echo ''
\d+ master.*

\echo ''
\echo '## Indexes'
\echo ''
SELECT 
    schemaname AS "Schema",
    tablename AS "Table",
    indexname AS "Index",
    indexdef AS "Definition"
FROM pg_indexes
WHERE schemaname IN ('public', 'org_podcastflow_pro', 'org_unfy', 'master')
ORDER BY schemaname, tablename, indexname;

\echo ''
\echo '## Foreign Key Relationships'
\echo ''
SELECT 
    tc.table_schema AS "Schema",
    tc.table_name AS "Table",
    kcu.column_name AS "Column",
    ccu.table_schema AS "References Schema",
    ccu.table_name AS "References Table",
    ccu.column_name AS "References Column"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'org_podcastflow_pro', 'org_unfy', 'master')
ORDER BY tc.table_schema, tc.table_name;

\echo ''
\echo '## Functions and Procedures'
\echo ''
SELECT 
    n.nspname AS "Schema",
    p.proname AS "Function",
    pg_catalog.pg_get_function_result(p.oid) AS "Returns",
    pg_catalog.pg_get_function_arguments(p.oid) AS "Arguments"
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'org_podcastflow_pro', 'org_unfy', 'master')
ORDER BY n.nspname, p.proname;

\o