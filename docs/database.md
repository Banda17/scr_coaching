# Database Implementation Guide

## Schema Overview

The Railway Operations Management System uses PostgreSQL with Drizzle ORM for type-safe database operations. The system implements four primary tables: users, trains, locations, and schedules. The implementation uses Drizzle ORM with TypeScript for type-safe database operations and includes comprehensive validation using Zod schemas.

### Type Definitions

```typescript
// User roles
export const UserRole = {
  Admin: 'admin',
  Operator: 'operator',
  Viewer: 'viewer'
} as const;

// Train types
export const TrainType = {
  Express: 'express',
  Local: 'local',
  Freight: 'freight',
  Special: 'special'
} as const;
```

### Table Structures

#### Users Table
```typescript
// Drizzle Schema Definition
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('viewer').$type<UserRole>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// SQL Schema
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);
```

Key Validations:
```typescript
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;
```

Key features:
- Auto-incrementing primary key
- Unique constraint on username
- Role-based access control
- Password stored with scrypt hashing
- Automatic timestamp tracking

#### Trains Table
```typescript
// Drizzle Schema Definition
export const trains = pgTable("trains", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  trainNumber: text("train_number").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default('local').$type<TrainType>(),
});

// SQL Schema
CREATE TABLE trains (
  id SERIAL PRIMARY KEY,
  train_number TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'local'
);

-- Indexes
CREATE INDEX idx_trains_number ON trains(train_number);
```

Key Validations:
```typescript
export const insertTrainSchema = createInsertSchema(trains);
export const selectTrainSchema = createSelectSchema(trains);
export type InsertTrain = z.infer<typeof insertTrainSchema>;
export type Train = z.infer<typeof selectTrainSchema>;
```

Key features:
- Unique train numbers
- Enumerated train types (express, local, freight, special)
- Optional description field

#### Locations Table
```typescript
// Drizzle Schema Definition
export const locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

// SQL Schema
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE
);

-- Indexes
CREATE INDEX idx_locations_code ON locations(code);
```

Key Validations:
```typescript
export const insertLocationSchema = createInsertSchema(locations);
export const selectLocationSchema = createSelectSchema(locations);
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = z.infer<typeof selectLocationSchema>;
```

Supported Location Codes:
- DVD (Divisional Office)
- GDR.KI
- NS
- BZA
- MTM
- COA

Key features:
- Unique location codes
- Standardized location names
- Used for route management

#### Schedules Table
```typescript
// Drizzle Schema Definition
export const schedules = pgTable("schedules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  trainId: integer("train_id").references(() => trains.id),
  departureLocationId: integer("departure_location_id").references(() => locations.id),
  arrivalLocationId: integer("arrival_location_id").references(() => locations.id),
  scheduledDeparture: timestamp("scheduled_departure").notNull(),
  scheduledArrival: timestamp("scheduled_arrival").notNull(),
  actualDeparture: timestamp("actual_departure"),
  actualArrival: timestamp("actual_arrival"),
  status: text("status").notNull().default('scheduled'),
  isCancelled: boolean("is_cancelled").notNull().default(false),
  // Array of 7 booleans representing running days from Monday (0) to Sunday (6)
  runningDays: boolean("running_days").array().notNull().default([true, true, true, true, true, true, true]),
  effectiveStartDate: timestamp("effective_start_date").notNull().default(sql`CURRENT_DATE`),
  effectiveEndDate: timestamp("effective_end_date"),
});

// SQL Schema
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  train_id INTEGER REFERENCES trains(id),
  departure_location_id INTEGER REFERENCES locations(id),
  arrival_location_id INTEGER REFERENCES locations(id),
  scheduled_departure TIMESTAMP NOT NULL,
  scheduled_arrival TIMESTAMP NOT NULL,
  actual_departure TIMESTAMP,
  actual_arrival TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'scheduled',
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  running_days BOOLEAN[] NOT NULL DEFAULT ARRAY[true, true, true, true, true, true, true],
  effective_start_date TIMESTAMP NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date TIMESTAMP
);

-- Indexes
CREATE INDEX idx_schedules_train ON schedules(train_id);
CREATE INDEX idx_schedules_departure ON schedules(departure_location_id);
CREATE INDEX idx_schedules_arrival ON schedules(arrival_location_id);
CREATE INDEX idx_schedules_dates ON schedules(scheduled_departure, scheduled_arrival);
CREATE INDEX idx_schedules_effective_dates ON schedules(effective_start_date, effective_end_date);
```

Key Validations:
```typescript
// Zod Schema for Schedule
export const insertScheduleSchema = createInsertSchema(schedules);
export const selectScheduleSchema = createSelectSchema(schedules);
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = z.infer<typeof selectScheduleSchema>;

// Extended Schedule Schema with Additional Validations
const extendedScheduleSchema = insertScheduleSchema.extend({
  trainId: z.number().min(1, "Train selection is required"),
  departureLocationId: z.number().min(1, "Departure location is required"),
  arrivalLocationId: z.number().min(1, "Arrival location is required"),
  scheduledDeparture: z.coerce.date(),
  scheduledArrival: z.coerce.date(),
  effectiveStartDate: z.date(),
  effectiveEndDate: z.date().nullable().optional(),
  runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
  status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
  isCancelled: z.boolean().default(false)
});
```

Key features:
- Foreign key relationships with trains and locations
- Temporal data tracking (scheduled vs actual times)
- Status management (scheduled, running, delayed, completed, cancelled)
- Running days array for weekly schedule patterns
- Effective date range for schedule validity

## Data Relationships

### Primary Relationships
1. Schedule → Train (Many-to-One)
   - Each schedule belongs to one train
   - One train can have multiple schedules

2. Schedule → Locations (Many-to-One)
   - Each schedule has departure and arrival locations
   - Locations can be used in multiple schedules

### Constraint Enforcement
1. Foreign Key Constraints
   ```sql
   ALTER TABLE schedules
   ADD CONSTRAINT fk_train
   FOREIGN KEY (train_id)
   REFERENCES trains(id)
   ON DELETE RESTRICT;

   ALTER TABLE schedules
   ADD CONSTRAINT fk_departure_location
   FOREIGN KEY (departure_location_id)
   REFERENCES locations(id)
   ON DELETE RESTRICT;

   ALTER TABLE schedules
   ADD CONSTRAINT fk_arrival_location
   FOREIGN KEY (arrival_location_id)
   REFERENCES locations(id)
   ON DELETE RESTRICT;
   ```

2. Check Constraints
   ```sql
   ALTER TABLE schedules
   ADD CONSTRAINT check_arrival_after_departure
   CHECK (scheduled_arrival > scheduled_departure);

   ALTER TABLE schedules
   ADD CONSTRAINT check_effective_dates
   CHECK (effective_end_date IS NULL OR effective_end_date > effective_start_date);
   ```

## Query Patterns

### Schedule Operations

#### Schedule Conflict Detection
```sql
-- Check for overlapping schedules with running days conflicts
WITH overlapping_schedules AS (
  SELECT *
  FROM schedules
  WHERE train_id = $1
    AND is_cancelled = false
    AND (scheduled_departure, scheduled_arrival) 
        OVERLAPS ($2, $3)
    AND effective_start_date <= $4
    AND (effective_end_date IS NULL 
         OR effective_end_date >= $5)
    AND id != $6
)
SELECT 
  os.*,
  t.train_number,
  dl.name as departure_location,
  al.name as arrival_location
FROM overlapping_schedules os
JOIN trains t ON os.train_id = t.id
JOIN locations dl ON os.departure_location_id = dl.id
JOIN locations al ON os.arrival_location_id = al.id;

-- Validate schedule times
SELECT 
  CASE 
    WHEN scheduled_arrival <= scheduled_departure 
    THEN 'Arrival must be after departure'
    WHEN effective_end_date IS NOT NULL 
         AND effective_end_date <= effective_start_date 
    THEN 'End date must be after start date'
    ELSE NULL 
  END as validation_error
FROM schedules
WHERE id = $1;
```

### Analytics Queries

#### Schedule Overview
```sql
-- Get schedule metrics
SELECT 
  COUNT(*) as total_schedules,
  SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
  SUM(CASE WHEN is_cancelled THEN 1 ELSE 0 END) as cancelled_count,
  SUM(CASE 
    WHEN status = 'completed' 
    AND actual_arrival IS NOT NULL 
    AND actual_departure IS NOT NULL
    THEN 1 ELSE 0 END) as completed_count
FROM schedules
WHERE scheduled_departure >= CURRENT_DATE - INTERVAL '30 days';

-- Train utilization analysis
SELECT 
  t.id AS train_id,
  t.train_number,
  t.type,
  COUNT(s.id) AS total_schedules,
  COUNT(DISTINCT DATE(s.scheduled_departure)) AS operation_days,
  AVG(CASE 
    WHEN s.actual_arrival IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (s.actual_arrival - s.scheduled_arrival))/60 
    ELSE 0 
  END) AS avg_delay_minutes
FROM trains t
LEFT JOIN schedules s ON t.id = s.train_id
WHERE s.scheduled_departure >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.id, t.train_number, t.type;
```

#### Route Performance Analysis
```sql
-- Detailed route performance
SELECT
  l.id AS departure_id,
  l.name AS departure_name,
  l.code AS departure_code,
  s.arrival_location_id,
  COUNT(s.id) AS total_trips,
  SUM(CASE WHEN s.status = 'delayed' THEN 1 ELSE 0 END) AS delayed_trips,
  ROUND(AVG(
    CASE 
      WHEN s.actual_arrival IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (s.actual_arrival - s.scheduled_arrival)) / 60 
      ELSE 0 
    END
  )::numeric, 2) AS avg_delay_minutes,
  SUM(
    CASE 
      WHEN EXTRACT(HOUR FROM s.scheduled_departure) BETWEEN 7 AND 9 
           OR EXTRACT(HOUR FROM s.scheduled_departure) BETWEEN 16 AND 18
      THEN 1 
      ELSE 0 
    END
  ) AS peak_hour_trips,
  COUNT(DISTINCT DATE(s.scheduled_departure)) AS operation_days,
  COUNT(DISTINCT s.train_id) AS unique_trains
FROM locations l
LEFT JOIN schedules s ON l.id = s.departure_location_id
WHERE s.scheduled_departure >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY l.id, l.name, l.code, s.arrival_location_id
ORDER BY total_trips DESC;

-- Peak hour analysis
SELECT 
  EXTRACT(HOUR FROM scheduled_departure) as hour,
  COUNT(*) as schedule_count,
  SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
  ROUND(AVG(
    CASE 
      WHEN actual_arrival IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (actual_arrival - scheduled_arrival)) / 60 
      ELSE 0 
    END
  )::numeric, 2) AS avg_delay_minutes
FROM schedules
WHERE scheduled_departure >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM scheduled_departure)
ORDER BY hour;
```

### Monitoring Queries

#### Performance Monitoring
```sql
-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as number_of_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('schedules', 'trains', 'locations')
ORDER BY idx_scan DESC;

-- Table statistics
SELECT
  schemaname,
  relname,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('schedules', 'trains', 'locations');

-- Active sessions and queries
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  backend_start,
  state,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE state != 'idle'
AND backend_type = 'client backend';
```

## Database Maintenance Procedures

### Daily Maintenance Tasks
```sql
-- Analyze tables for query optimization
ANALYZE schedules;
ANALYZE trains;
ANALYZE locations;

-- Update table statistics
VACUUM ANALYZE schedules;
VACUUM ANALYZE trains;
VACUUM ANALYZE locations;

-- Reindex to maintain index health
REINDEX TABLE schedules;
REINDEX TABLE trains;
REINDEX TABLE locations;
```

### Weekly Maintenance Tasks
```sql
-- Clean up expired sessions
DELETE FROM sessions WHERE expires < NOW();

-- Remove cancelled schedules older than 90 days
DELETE FROM schedules 
WHERE is_cancelled = true 
AND scheduled_departure < CURRENT_DATE - INTERVAL '90 days';

-- Update system statistics
ANALYZE VERBOSE;
```

### Monthly Maintenance Tasks
```sql
-- Full VACUUM to reclaim storage
VACUUM FULL VERBOSE ANALYZE schedules;
VACUUM FULL VERBOSE ANALYZE trains;
VACUUM FULL VERBOSE ANALYZE locations;

-- Recompute table and index statistics
ANALYZE VERBOSE;
```

## Backup and Recovery Procedures

### Backup Commands
```bash
# Daily full backup
pg_dump -Fc -f "backup_$(date +%Y%m%d).dump" railway_operations

# Backup specific tables
pg_dump -Fc -t schedules -t trains -t locations -f "tables_backup_$(date +%Y%m%d).dump" railway_operations

# Include COPY statements for data transfer
pg_dump -a --column-inserts -f "data_backup_$(date +%Y%m%d).sql" railway_operations
```

### Recovery Commands
```bash
# Restore full backup
pg_restore -d railway_operations backup_20241121.dump

# Restore specific tables
pg_restore -d railway_operations -t schedules -t trains tables_backup_20241121.dump

# Restore with clean option (drops existing objects)
pg_restore -c -d railway_operations backup_20241121.dump
```

## Performance Tuning Guidelines

### Index Optimization
1. Maintain optimal fill factor
```sql
ALTER TABLE schedules SET (fillfactor = 90);
ALTER TABLE trains SET (fillfactor = 90);
ALTER TABLE locations SET (fillfactor = 90);
```

2. Create partial indexes for common queries
```sql
-- Index for active schedules
CREATE INDEX idx_active_schedules ON schedules (train_id, scheduled_departure)
WHERE NOT is_cancelled AND status != 'completed';

-- Index for delayed trains
CREATE INDEX idx_delayed_schedules ON schedules (train_id, scheduled_departure)
WHERE status = 'delayed';
```

3. Regular index maintenance
```sql
-- Rebuild bloated indexes
REINDEX INDEX idx_schedules_train;
REINDEX INDEX idx_schedules_departure;
REINDEX INDEX idx_schedules_arrival;
```

### Query Optimization Tips
1. Use prepared statements for frequent queries
2. Implement connection pooling with appropriate pool size
3. Use EXPLAIN ANALYZE for query performance analysis
4. Regular VACUUM and ANALYZE operations
5. Monitor and adjust work_mem based on query complexity

## Troubleshooting Guide

### Common Issues and Solutions

1. Connection Issues
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection limits
SHOW max_connections;

-- Terminate idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < NOW() - INTERVAL '1 hour';
```

2. Lock Issues
```sql
-- Identify blocking queries
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.usename AS blocked_user,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
WHERE NOT blocked_locks.GRANTED;

-- Kill blocking queries if necessary
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid IN (SELECT blocking_locks.pid 
             FROM pg_catalog.pg_locks blocked_locks
             JOIN pg_catalog.pg_locks blocking_locks ON ...)
```

3. Performance Issues
```sql
-- Identify slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
AND now() - pg_stat_activity.query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Check index usage
SELECT relname, 
       idx_scan as index_scans,
       seq_scan as sequential_scans,
       idx_tup_fetch as rows_fetched_by_index,
       seq_tup_read as rows_fetched_by_seq_scan
FROM pg_stat_user_tables 
WHERE idx_scan + seq_scan > 0 
ORDER BY seq_scan DESC;
```
## Performance Optimization

### Index Strategy
1. B-tree indexes for exact matches and ranges
2. Compound indexes for frequently combined columns
3. Partial indexes for specific queries
4. Regular index maintenance

### Query Optimization
1. Use prepared statements
2. Implement connection pooling
3. Batch operations for bulk updates
4. Regular VACUUM and ANALYZE

### Connection Management
```typescript
const db = drizzle(sql, {
  logger: true,
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production',
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
  }
});
```

## Security Measures

### Access Control
1. Role-based permissions
2. Connection string security
3. SSL enforcement in production
4. Prepared statements to prevent SQL injection

### Data Protection
1. Password hashing
2. Audit logging
3. Input validation
4. Output sanitization

## Backup and Recovery

### Backup Strategy
1. Daily full backups
2. Point-in-time recovery
3. Transaction logs
4. Regular backup testing

### Recovery Procedures
1. Database restoration
2. Transaction replay
3. Data verification
4. Integrity checks

## Maintenance Procedures

### Regular Tasks
1. VACUUM operations
2. Index rebuilding
3. Statistics updates
4. Performance monitoring

### Monitoring Queries
```sql
-- Active connections
SELECT * FROM pg_stat_activity;

-- Table statistics
SELECT schemaname, relname, seq_scan, seq_tup_read, 
       idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, 
       n_tup_del, n_live_tup, n_dead_tup, last_vacuum, 
       last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, 
       idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes;
```

## Troubleshooting Guide

### Common Issues
1. Connection timeouts
2. Lock contention
3. Query performance
4. Index bloat

### Diagnostic Queries
```sql
-- Lock analysis
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.usename AS blocked_user,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```
