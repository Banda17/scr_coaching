import { sql } from 'drizzle-orm';

export const migration = sql`
-- Add new columns for train attachment functionality
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS attach_train_number TEXT,
ADD COLUMN IF NOT EXISTS attach_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS attach_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS attach_location_id INTEGER REFERENCES locations(id),
ADD COLUMN IF NOT EXISTS detach_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS detach_location_id INTEGER REFERENCES locations(id);

-- Add constraints
ALTER TABLE schedules
ADD CONSTRAINT check_attach_time_range 
CHECK (attach_time IS NULL OR (attach_time >= scheduled_departure AND attach_time <= scheduled_arrival));

ALTER TABLE schedules
ADD CONSTRAINT check_detach_time_range 
CHECK (detach_time IS NULL OR (detach_time >= scheduled_departure AND detach_time <= scheduled_arrival));
`;
