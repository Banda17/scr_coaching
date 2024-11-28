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

  

  // Table cleaning endpoint with audit logging
  app.post("/api/admin/clean-tables", requireRole(UserRole.Admin), async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const tableSchema = z.object({
        tables: z.array(z.enum(['schedules', 'trains', 'locations', 'users'])).min(1),
        preserveAdmin: z.boolean().default(true),
        preserveReferences: z.boolean().default(true)
      });
      
      const { tables, preserveAdmin, preserveReferences } = tableSchema.parse(req.body);
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const cleanedTables: string[] = [];

      await db.transaction(async (tx) => {
        // Sort tables to handle dependencies
        const sortedTables = [...tables].sort((a, b) => {
          if (a === 'schedules') return -1;
          if (b === 'schedules') return 1;
          return 0;
        });

        // Process each table
        for (const table of sortedTables) {
          switch (table) {
            case 'schedules':
              await tx.delete(schedules);
              cleanedTables.push('schedules');
              break;

            case 'trains':
              if (preserveReferences) {
                const trainsInUse = await tx
                  .select({ id: trains.id })
                  .from(trains)
                  .innerJoin(schedules, eq(schedules.trainId, trains.id));
                
                if (trainsInUse.length > 0) {
                  throw new Error('Cannot clean trains table while preserving references');
                }
              }
              await tx.delete(trains);
              cleanedTables.push('trains');
              break;

            case 'locations':
              if (preserveReferences) {
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
                  throw new Error('Cannot clean locations table while preserving references');
                }
              }
              await tx.delete(locations);
              cleanedTables.push('locations');
              break;

            case 'users':
              if (preserveAdmin) {
                await tx.delete(users).where(sql`role != ${UserRole.Admin}`);
              } else {
                await tx.delete(users);
              }
              cleanedTables.push('users');
              break;
          }
        }
      });

      res.json({
        success: true,
        message: `Successfully cleaned tables: ${cleanedTables.join(', ')}`,
        cleanedTables
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

  // Trains endpoints
  app.get("/api/trains", async (req, res) => {
    try {
      const allTrains = await db
        .select()
        .from(trains)
        .orderBy(trains.trainNumber);

      res.json(allTrains);
    } catch (error) {
      console.error("[API] Failed to fetch trains:", error);
      res.status(500).json({
        error: "Failed to fetch trains",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
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

  // Location management endpoints with proper validation and error handling
  app.post("/api/locations", requireRole(UserRole.Admin), async (req, res) => {
    try {
      // Create a Zod schema for location validation
      const locationSchema = z.object({
        name: z.string().min(1, "Location name is required"),
        code: z.string().min(1, "Location code is required").max(10, "Location code must be 10 characters or less").toUpperCase(),
      });
      
      // Validate the request body
      const result = locationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Invalid location data",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const { name, code } = result.data;

      // Check for existing location with same code
      const [existingLocation] = await db
        .select()
        .from(locations)
        .where(eq(locations.code, code))
        .limit(1);

      if (existingLocation) {
        return res.status(409).json({
          error: "Location already exists",
          details: `A location with code ${code} already exists`
        });
      }

      // Insert the new location
      const [newLocation] = await db
        .insert(locations)
        .values({
          name,
          code
        })
        .returning();

      res.status(200).json({
        message: "Location created successfully",
        location: newLocation
      });
    } catch (error) {
      console.error("[API] Failed to create location:", error);
      res.status(500).json({
        error: "Failed to create location",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/locations", async (req, res) => {
    try {
      const allLocations = await db
        .select()
        .from(locations)
        .orderBy(locations.name);

      res.json(allLocations);
    } catch (error) {
      console.error("[API] Failed to fetch locations:", error);
      res.status(500).json({
        error: "Failed to fetch locations",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Bulk import locations with validation
  app.post("/api/locations/import", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const locationSchema = z.object({
        name: z.string().min(1, "Location name is required"),
        code: z.string().min(1, "Location code is required").max(10, "Location code must be 10 characters or less").toUpperCase(),
      });

      const locationsArray = z.array(locationSchema);
      const result = locationsArray.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid location data",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const locations_to_import = result.data;
      const results = {
        success: [] as any[],
        failures: [] as any[]
      };

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        for (const location of locations_to_import) {
          try {
            // Check for existing location
            const [existingLocation] = await tx
              .select()
              .from(locations)
              .where(eq(locations.code, location.code))
              .limit(1);

            if (existingLocation) {
              results.failures.push({
                location,
                error: `Location with code ${location.code} already exists`
              });
              continue;
            }

            // Insert new location
            const [newLocation] = await tx
              .insert(locations)
              .values(location)
              .returning();

            results.success.push(newLocation);
          } catch (error) {
            results.failures.push({
              location,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
      });

      res.json({
        message: "Import completed",
        summary: {
          total: locations_to_import.length,
          successful: results.success.length,
          failed: results.failures.length
        },
        results
      });
    } catch (error) {
      console.error("[API] Failed to import locations:", error);
      res.status(500).json({
        error: "Failed to import locations",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });
}