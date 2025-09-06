-- PostgreSQL Health Monitoring Queries for PodcastFlow Pro
-- Run these queries regularly to monitor database health

-- ============================================
-- 1. ENABLE SLOW QUERY LOGGING
-- ============================================

-- Enable logging of slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries slower than 1 second
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_statement = 'mod'; -- Log all data-modifying statements

-- Apply changes
SELECT pg_reload_conf();

-- View current settings
SELECT name, setting, unit, source 
FROM pg_settings 
WHERE name LIKE 'log_%' 
ORDER BY name;

-- ============================================
-- 2. DATABASE SIZE AND GROWTH
-- ============================================

-- Overall database size
SELECT 
    current_database() as database,
    pg_size_pretty(pg_database_size(current_database())) as size,
    pg_database_size(current_database()) as size_bytes;

-- Size by schema
SELECT 
    schemaname as schema,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size,
    sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint as size_bytes
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY size_bytes DESC;

-- Top 20 largest tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- ============================================
-- 3. INDEX USAGE ANALYSIS
-- ============================================

-- Unused indexes (candidates for removal)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelid NOT IN (
    SELECT conindid FROM pg_constraint WHERE contype = 'p' -- Exclude primary keys
)
ORDER BY pg_relation_size(indexrelid) DESC;

-- Missing indexes (based on sequential scans)
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_scan::float / NULLIF(idx_scan + seq_scan, 0) as seq_scan_ratio,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
AND pg_relation_size(schemaname||'.'||tablename) > 5242880 -- Tables larger than 5MB
ORDER BY seq_scan - idx_scan DESC
LIMIT 20;

-- Index bloat analysis
WITH btree_index_atts AS (
    SELECT 
        nspname,
        indexclass.relname as index_name,
        indexclass.reltuples,
        indexclass.relpages,
        tableclass.relname as tablename,
        (regexp_split_to_table(indkey::text, ' ')::int) as attnum,
        indexrelid
    FROM pg_index
    JOIN pg_class AS indexclass ON pg_index.indexrelid = indexclass.oid
    JOIN pg_class AS tableclass ON pg_index.indrelid = tableclass.oid
    JOIN pg_namespace ON pg_namespace.oid = indexclass.relnamespace
    WHERE indexclass.relkind = 'i'
    AND nspname NOT IN ('pg_catalog', 'information_schema')
),
index_item_sizes AS (
    SELECT 
        ind_atts.nspname,
        ind_atts.index_name,
        ind_atts.reltuples,
        ind_atts.relpages,
        ind_atts.tablename,
        pg_relation_size(ind_atts.indexrelid) as index_bytes
    FROM btree_index_atts AS ind_atts
    GROUP BY 1,2,3,4,5,6
)
SELECT
    nspname as schema,
    tablename,
    index_name,
    pg_size_pretty(index_bytes) as index_size,
    CASE WHEN relpages > 0
        THEN round(100 * (relpages - (reltuples * 8) / 8192) / relpages, 2)
        ELSE 0
    END as bloat_percentage
FROM index_item_sizes
WHERE relpages > 100
ORDER BY index_bytes DESC
LIMIT 20;

-- ============================================
-- 4. TABLE BLOAT ANALYSIS
-- ============================================

WITH constants AS (
    SELECT current_setting('block_size')::numeric AS bs, 23 AS hdr, 4 AS ma
),
table_bloat AS (
    SELECT
        schemaname,
        tablename,
        cc.relpages,
        bs,
        CEIL((cc.reltuples*((datahdr+ma-
            (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta
    FROM (
        SELECT
            ma,bs,schemaname,tablename,
            (datawidth+(hdr+ma-(case when hdr%ma=0 then ma else hdr%ma end)))::numeric AS datahdr,
            (maxfracsum*(nullhdr+ma-(case when nullhdr%ma=0 then ma else nullhdr%ma end))) AS nullhdr2
        FROM (
            SELECT
                schemaname, tablename, hdr, ma, bs,
                SUM((1-null_frac)*avg_width) AS datawidth,
                MAX(null_frac) AS maxfracsum,
                hdr+(
                    SELECT 1+count(*)/8
                    FROM pg_stats s2
                    WHERE null_frac<>0 AND s2.schemaname = s.schemaname AND s2.tablename = s.tablename
                ) AS nullhdr
            FROM pg_stats s, constants
            GROUP BY 1,2,3,4,5
        ) AS foo
    ) AS rs
    JOIN pg_class cc ON cc.relname = rs.tablename
    JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = rs.schemaname
    WHERE cc.relkind = 'r'
)
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    CASE WHEN relpages > otta
        THEN round(100 * (relpages - otta) / relpages, 2)
        ELSE 0
    END as bloat_percentage
FROM table_bloat
WHERE relpages > 100
AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY relpages - otta DESC
LIMIT 20;

-- ============================================
-- 5. CONNECTION AND LOCK MONITORING
-- ============================================

-- Current connections by state
SELECT 
    state,
    count(*) as connections,
    max(now() - state_change) as max_duration
FROM pg_stat_activity
WHERE backend_type = 'client backend'
GROUP BY state
ORDER BY connections DESC;

-- Long-running queries
SELECT 
    pid,
    usename,
    datname,
    state,
    backend_start,
    xact_start,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    substring(query, 1, 100) as query_sample,
    now() - query_start as query_duration
FROM pg_stat_activity
WHERE state != 'idle'
AND query_start < now() - interval '5 minutes'
ORDER BY query_start;

-- Blocked queries
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_query,
    blocking_activity.query AS blocking_query,
    blocked_activity.application_name AS blocked_application,
    blocking_activity.application_name AS blocking_application
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================
-- 6. PERFORMANCE METRICS
-- ============================================

-- Cache hit ratio (should be > 95%)
SELECT 
    'index' as cache_type,
    sum(idx_blks_read) as disk_reads,
    sum(idx_blks_hit) as cache_hits,
    CASE WHEN sum(idx_blks_read + idx_blks_hit) > 0
        THEN round(100.0 * sum(idx_blks_hit) / sum(idx_blks_read + idx_blks_hit), 2)
        ELSE 0
    END as cache_hit_ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT 
    'table' as cache_type,
    sum(heap_blks_read) as disk_reads,
    sum(heap_blks_hit) as cache_hits,
    CASE WHEN sum(heap_blks_read + heap_blks_hit) > 0
        THEN round(100.0 * sum(heap_blks_hit) / sum(heap_blks_read + heap_blks_hit), 2)
        ELSE 0
    END as cache_hit_ratio
FROM pg_statio_user_tables;

-- Transaction statistics
SELECT 
    datname,
    numbackends as active_connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_read as disk_blocks_read,
    blks_hit as buffer_hits,
    tup_returned as rows_returned,
    tup_fetched as rows_fetched,
    tup_inserted as rows_inserted,
    tup_updated as rows_updated,
    tup_deleted as rows_deleted
FROM pg_stat_database
WHERE datname = current_database();

-- ============================================
-- 7. MAINTENANCE REQUIREMENTS
-- ============================================

-- Tables needing VACUUM
SELECT 
    schemaname,
    tablename,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples,
    round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
AND round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 5
ORDER BY dead_tuples DESC;

-- Tables needing ANALYZE
SELECT 
    schemaname,
    tablename,
    n_mod_since_analyze as modifications_since_analyze,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_mod_since_analyze > 1000
ORDER BY n_mod_since_analyze DESC;

-- ============================================
-- 8. TENANT-SPECIFIC HEALTH CHECKS
-- ============================================

-- Activity by tenant schema
SELECT 
    schemaname,
    COUNT(DISTINCT tablename) as table_count,
    SUM(seq_scan) as total_seq_scans,
    SUM(idx_scan) as total_index_scans,
    SUM(n_tup_ins) as total_inserts,
    SUM(n_tup_upd) as total_updates,
    SUM(n_tup_del) as total_deletes
FROM pg_stat_user_tables
WHERE schemaname LIKE 'org_%'
GROUP BY schemaname
ORDER BY schemaname;

-- Largest tables per tenant
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname LIKE 'org_%'
AND pg_total_relation_size(schemaname||'.'||tablename) > 10485760 -- 10MB
ORDER BY schemaname, pg_total_relation_size(schemaname||'.'||tablename) DESC;