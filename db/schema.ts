import { pgTable, text, integer, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const UserRole = {
  Admin: 'admin',
  Operator: 'operator',
  Viewer: 'viewer'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('viewer').$type<UserRole>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const TrainType = {
  Express: 'express',
  Local: 'local',
  Freight: 'freight',
  SPIC: 'spic',
  FTR: 'ftr',
  SALOON: 'saloon',
  TRC: 'trc',
  Passenger: 'passenger',
  MailExpress: 'mail_express',
  Superfast: 'superfast',
  Premium: 'premium',
  Suburban: 'suburban',
  MEMU: 'memu',
  DEMU: 'demu'
} as const;

export type TrainType = typeof TrainType[keyof typeof TrainType];

export const trains = pgTable("trains", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  trainNumber: text("train_number").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default('local').$type<TrainType>(),
  maxSpeed: integer("max_speed"),
  passengerCapacity: integer("passenger_capacity"),
  cargoCapacityTons: integer("cargo_capacity_tons"),
  priorityLevel: integer("priority_level"),
  features: text("features").array(),
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
  // Array of 7 booleans representing running days from Monday (0) to Sunday (6)
  runningDays: boolean("running_days").array().notNull().default([true, true, true, true, true, true, true]),
  effectiveStartDate: timestamp("effective_start_date").notNull().default(sql`CURRENT_DATE`),
  effectiveEndDate: timestamp("effective_end_date"),
  // Fields for SALOON and FTR trains
  shortRouteLocationId: integer("short_route_location_id").references(() => locations.id),
  detachLocationId: integer("detach_location_id").references(() => locations.id),
  attachLocationId: integer("attach_location_id").references(() => locations.id),
  detachTime: timestamp("detach_time"),
  attachTime: timestamp("attach_time"),
  attachTrainNumber: text("attach_train_number"),
  attachStatus: text("attach_status").default('pending'),
  remarks: text("remarks"),
  // New fields for SPIC and SPL trains
  takingOverTime: timestamp("taking_over_time"),
  handingOverTime: timestamp("handing_over_time"),
  importantStations: json("important_stations").default([]), // Array of {locationId, arrivalTime, departureTime}
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
// Extended Schedule type with train information
export interface Schedule extends z.infer<typeof selectScheduleSchema> {
  train?: {
    id: number;
    trainNumber: string;
    type: TrainType;
    description?: string;
  };
}

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;



