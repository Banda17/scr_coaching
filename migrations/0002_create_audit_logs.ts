import { sql } from 'drizzle-orm';
import { pgTable, text, integer, timestamp, json } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references('users.id'),
  action: text('action').notNull(),
  tableName: text('table_name').notNull(),
  details: json('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  ipAddress: text('ip_address'),
  status: text('status').notNull().default('success')
});

// Run migration
export const migration = sql`
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'success'
)`;
