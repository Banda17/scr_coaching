import type { Express } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db";
import { schedules, trains, locations, users, auditLogs } from "@db/schema";
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
  // Audit log endpoint
  app.get("/api/admin/audit-logs", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const logs = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          action: auditLogs.action,
          tableName: auditLogs.tableName,
          details: auditLogs.details,
          timestamp: auditLogs.timestamp,
          ipAddress: auditLogs.ipAddress,
          status: auditLogs.status,
          user: {
            username: users.username,
            role: users.role
          }
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.timestamp));

      res.json(logs);
    } catch (error) {
      console.error("[API] Failed to fetch audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/admin/clean-tables", requireRole(UserRole.Admin), async (req, res) => {
    try {
      // Verify user authentication
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Verify admin role
      if (req.user.role !== UserRole.Admin) {
        return res.status(403).json({ error: "Admin privileges required" });
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const tableSchema = z.object({
        tables: z.array(z.enum(['schedules', 'trains', 'locations', 'users'])).min(1),
        preserveAdmin: z.boolean().default(true),
        preserveReferences: z.boolean().default(true)
      });
      
      const { tables, preserveAdmin, preserveReferences } = tableSchema.parse(req.body);
      
      // Start a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // Create audit log entry for the clean operation start
        const auditEntry = await tx.insert(auditLogs).values({
          userId: req.user.id,
          action: 'clean_tables_start',
          tableName: 'multiple',
          details: { tables, preserveAdmin, preserveReferences },
          ipAddress: clientIp as string,
          status: 'in_progress'
        }).returning();

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
                try {
                  await tx.delete(schedules);
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'schedules',
                    details: { preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'success'
                  });
                  console.log('[Clean Tables] Successfully cleaned schedules table');
                } catch (error) {
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'schedules',
                    details: { error: error instanceof Error ? error.message : 'Unknown error', preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'error'
                  });
                  throw error;
                }
                break;
              
              case 'trains':
                try {
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
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'trains',
                    details: { preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'success'
                  });
                  console.log('[Clean Tables] Successfully cleaned trains table');
                } catch (error) {
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'trains',
                    details: { error: error instanceof Error ? error.message : 'Unknown error', preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'error'
                  });
                  throw error;
                }
                break;
              
              case 'locations':
                try {
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
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'locations',
                    details: { preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'success'
                  });
                  console.log('[Clean Tables] Successfully cleaned locations table');
                } catch (error) {
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'locations',
                    details: { error: error instanceof Error ? error.message : 'Unknown error', preserveReferences },
                    ipAddress: clientIp as string,
                    status: 'error'
                  });
                  throw error;
                }
                break;
              
              case 'users':
                try {
                  if (preserveAdmin) {
                    await tx
                      .delete(users)
                      .where(sql`role != ${UserRole.Admin}`);
                    await tx.insert(auditLogs).values({
                      userId: req.user.id,
                      action: 'clean_table',
                      tableName: 'users',
                      details: { preserveAdmin, mode: 'non_admin_only' },
                      ipAddress: clientIp as string,
                      status: 'success'
                    });
                    console.log('[Clean Tables] Successfully cleaned non-admin users');
                  } else {
                    await tx.delete(users);
                    await tx.insert(auditLogs).values({
                      userId: req.user.id,
                      action: 'clean_table',
                      tableName: 'users',
                      details: { preserveAdmin, mode: 'all_users' },
                      ipAddress: clientIp as string,
                      status: 'success'
                    });
                    console.log('[Clean Tables] Successfully cleaned all users');
                  }
                } catch (error) {
                  await tx.insert(auditLogs).values({
                    userId: req.user.id,
                    action: 'clean_table',
                    tableName: 'users',
                    details: { error: error instanceof Error ? error.message : 'Unknown error', preserveAdmin },
                    ipAddress: clientIp as string,
                    status: 'error'
                  });
                  throw error;
                }
                break;
            }
          } catch (error) {
            console.error(`[Clean Tables] Failed to clean ${table} table:`, error);
            throw error; // Re-throw to trigger transaction rollback
          }
        }
      });

      // Update the initial audit log entry with success status
      await db.update(auditLogs)
        .set({ 
          status: 'success',
          details: { 
            message: `Successfully cleaned tables: ${tables.join(', ')}`,
            preserveAdmin,
            preserveReferences,
            cleanedTables: tables
          }
        })
        .where(eq(auditLogs.id, auditEntry[0].id));

      res.json({ 
        success: true, 
        message: `Successfully cleaned tables: ${tables.join(', ')}`,
        preserveAdmin,
        preserveReferences,
        cleanedTables: tables
      });
    } catch (error) {
      console.error("[API] Failed to clean tables:", error);

      // Create a final audit log entry for the failure
      try {
        await db.insert(auditLogs).values({
          userId: req.user?.id,
          action: 'clean_tables_error',
          tableName: 'multiple',
          details: { 
            error: error instanceof Error ? error.message : "Unknown error",
            tables,
            preserveAdmin,
            preserveReferences
          },
          ipAddress: clientIp as string,
          status: 'error'
        });
      } catch (auditError) {
        console.error("[API] Failed to create audit log entry:", auditError);
      }

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
