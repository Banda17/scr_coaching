import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const trains = pgTable("trains", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  trainNumber: text("train_number").notNull().unique(),
  description: text("description"),
});

export const locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

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
});

export const insertTrainSchema = createInsertSchema(trains);
export const selectTrainSchema = createSelectSchema(trains);
export type InsertTrain = z.infer<typeof insertTrainSchema>;
export type Train = z.infer<typeof selectTrainSchema>;

export const insertLocationSchema = createInsertSchema(locations);
export const selectLocationSchema = createSelectSchema(locations);
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = z.infer<typeof selectLocationSchema>;

export const insertScheduleSchema = createInsertSchema(schedules);
export const selectScheduleSchema = createSelectSchema(schedules);
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = z.infer<typeof selectScheduleSchema>;
