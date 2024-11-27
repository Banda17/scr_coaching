import type { Express } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db";
import { schedules, trains, locations, users } from "@db/schema";
import { eq, sql, and, gte, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireRole, setupAuth } from "./auth";
import { UserRole } from "@db/schema";
import { crypto } from "./auth";
import * as z from "zod";

const upload = multer();

export function registerRoutes(app: Express) {
  // Setup authentication routes
  setupAuth(app);

  // Create table aliases for locations
  const arrivalLocations = alias(locations, 'arrival_locations');

  // Selective table cleaning endpoint with proper error handling and logging
  app.post("/api/admin/clean-tables", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const tableSchema = z.object({
        tables: z.array(z.enum(['schedules', 'trains', 'locations', 'users']))
          .min(1, "At least one table must be selected for cleaning")
          .describe("Tables to clean"),
        preserveAdmin: z.boolean().default(true)
          .describe("Whether to preserve admin users"),
        preserveReferences: z.boolean().default(true)
          .describe("Whether to preserve referenced records")
      });
      
      const { tables, preserveAdmin, preserveReferences } = tableSchema.parse(req.body);
      
      // Start a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // Sort tables to handle dependencies
        const sortedTables = [...tables].sort((a, b) => {
          // Ensure schedules are cleaned first as they reference other tables
          if (a === 'schedules') return -1;
          if (b === 'schedules') return 1;
          return 0;
        });

        for (const table of sortedTables) {
          try {
            switch (table) {
              case 'schedules':
                await tx.delete(schedules);
                console.log('[Clean Tables] Successfully cleaned schedules table');
                break;
              
              case 'trains':
                if (preserveReferences) {
                  // Check if any schedules reference this train
                  const trainsInUse = await tx
                    .select({ id: trains.id })
                    .from(trains)
                    .innerJoin(schedules, eq(schedules.trainId, trains.id));
                  
                  if (trainsInUse.length > 0) {
                    throw new Error('Cannot clean trains table while preserving references - trains are still in use by schedules');
                  }
                }
                await tx.delete(trains);
                console.log('[Clean Tables] Successfully cleaned trains table');
                break;
              
              case 'locations':
                if (preserveReferences) {
                  // Check if any schedules reference these locations
                  const locationsInUse = await tx
                    .select({ id: locations.id })
                    .from(locations)
                    .innerJoin(
                      schedules,
                      or(
                        eq(schedules.departureLocationId, locations.id),
                        eq(schedules.arrivalLocationId, locations.id)
                      )
                    );
                  
                  if (locationsInUse.length > 0) {
                    throw new Error('Cannot clean locations table while preserving references - locations are still in use by schedules');
                  }
                }
                await tx.delete(locations);
                console.log('[Clean Tables] Successfully cleaned locations table');
                break;
              
              case 'users':
                if (preserveAdmin) {
                  await tx
                    .delete(users)
                    .where(sql`role != ${UserRole.Admin}`);
                  console.log('[Clean Tables] Successfully cleaned non-admin users');
                } else {
                  await tx.delete(users);
                  console.log('[Clean Tables] Successfully cleaned all users');
                }
                break;
            }
          } catch (error) {
            console.error(`[Clean Tables] Failed to clean ${table} table:`, error);
            throw error; // Re-throw to trigger transaction rollback
          }
        }
      });

      res.json({ 
        success: true, 
        message: `Successfully cleaned tables: ${tables.join(', ')}`,
        preserveAdmin,
        preserveReferences,
        cleanedTables: tables
      });
    } catch (error) {
      console.error("[API] Failed to clean tables:", error);
      res.status(500).json({ 
        error: "Failed to clean tables",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Schedules endpoint with proper table aliasing
  app.get("/api/schedules", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const results = await db.select({
        id: schedules.id,
        trainId: schedules.trainId,
        departureLocationId: schedules.departureLocationId,
        arrivalLocationId: schedules.arrivalLocationId,
        scheduledDeparture: schedules.scheduledDeparture,
        scheduledArrival: schedules.scheduledArrival,
        actualDeparture: schedules.actualDeparture,
        actualArrival: schedules.actualArrival,
        status: schedules.status,
        isCancelled: schedules.isCancelled,
        runningDays: schedules.runningDays,
        effectiveStartDate: schedules.effectiveStartDate,
        effectiveEndDate: schedules.effectiveEndDate,
        train: {
          id: trains.id,
          trainNumber: trains.trainNumber,
          type: trains.type,
          description: trains.description
        },
        departureLocation: {
          id: locations.id,
          name: locations.name,
          code: locations.code
        },
        arrivalLocation: {
          id: arrivalLocations.id,
          name: arrivalLocations.name,
          code: arrivalLocations.code
        }
      })
      .from(schedules)
      .leftJoin(trains, eq(schedules.trainId, trains.id))
      .leftJoin(locations, eq(schedules.departureLocationId, locations.id))
      .leftJoin(arrivalLocations, eq(schedules.arrivalLocationId, arrivalLocations.id))
      .where(
        startDate && endDate
          ? and(
              gte(schedules.scheduledDeparture, new Date(startDate as string)),
              lte(schedules.scheduledDeparture, new Date(endDate as string))
            )
          : undefined
      );

      res.json(results);
    } catch (error) {
      console.error("[API] Failed to fetch schedules:", error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Simple check - if we can query the database, it's healthy
      await db.select().from(users).limit(1);
      res.json({ status: "healthy", database: "connected" });
    } catch (error) {
      res.status(503).json({ status: "unhealthy", database: "disconnected" });
    }
  });

  // Other routes remain unchanged...
}
