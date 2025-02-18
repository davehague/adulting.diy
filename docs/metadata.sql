-- Get column details for all tables in the "adulting" schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'adulting'
ORDER BY table_name, ordinal_position;

-- Get primary keys for all tables in the "adulting" schema
SELECT 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' 
    AND tc.table_schema = 'adulting'
ORDER BY tc.table_name;

-- Get foreign keys for all tables in the "adulting" schema
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name, 
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'adulting'
ORDER BY tc.table_name;

-- Get indexes for all tables in the "adulting" schema
SELECT 
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'adulting'
ORDER BY tablename, indexname;