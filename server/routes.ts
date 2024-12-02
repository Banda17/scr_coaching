import type { Express, Request, Response } from "express";
import express from 'express';
const router = express.Router();
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db";
import { schedules, trains, locations, users, TrainType } from "@db/schema";
import { eq, sql, and, gte, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireRole, setupAuth } from "./auth";
import { UserRole } from "@db/schema";
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

  // Train types import endpoint with proper validation and authentication
  app.post("/api/trains/import-types", requireRole(UserRole.Admin), async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const trainTypeSchema = z.object({
        type: z.nativeEnum(TrainType),
        description: z.string().min(1, "Description is required"),
        max_speed: z.number().positive().optional(),
        priority_level: z.number().min(1).max(10).optional(),
        features: z.array(z.string()).optional()
      });

      const importSchema = z.object({
        train_types: z.array(trainTypeSchema).min(1, "At least one train type is required")
      });

      const result = importSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid train types data",
          details: result.error.issues
        });
      }

      const results = {
        success: [] as any[],
        failures: [] as any[]
      };

      // Validate and map train type to our system's TrainType enum
      function validateAndMapTrainType(type: string): TrainType {
        // Create a mapping between various formats and our TrainType enum
        const typeMapping: Record<string, TrainType> = {
          // Standard formats
          'express': TrainType.Express,
          'local': TrainType.Local,
          'freight': TrainType.Freight,
          'spic': TrainType.SPIC,
          'ftr': TrainType.FTR,
          'saloon': TrainType.SALOON,
          'trc': TrainType.TRC,
          'passenger': TrainType.Passenger,
          'mail_express': TrainType.MailExpress,
          'superfast': TrainType.Superfast,
          'premium': TrainType.Premium,
          'suburban': TrainType.Suburban,
          'memu': TrainType.MEMU,
          'demu': TrainType.DEMU,
          
          // Alternative formats
          'exp': TrainType.Express,
          'mail': TrainType.MailExpress,
          'sf': TrainType.Superfast,
          'sub': TrainType.Suburban,
          'pass': TrainType.Passenger,
        };
        
        const normalizedType = type.toLowerCase().trim();
        
        // Check for exact match
        if (normalizedType in typeMapping) {
          return typeMapping[normalizedType];
        }
        
        // Check for partial matches
        const partialMatches = Object.entries(typeMapping)
          .filter(([key]) => key.includes(normalizedType) || normalizedType.includes(key));
        
        if (partialMatches.length === 1) {
          return partialMatches[0][1];
        }
        
        if (partialMatches.length > 1) {
          throw new Error(`Ambiguous train type '${type}'. Could match: ${partialMatches.map(([key]) => key).join(', ')}`);
        }
        
        throw new Error(`Unsupported train type: ${type}. Valid types are: ${Object.keys(typeMapping).join(', ')}`);
      }

      await db.transaction(async (tx) => {
        for (const trainType of result.data.train_types) {
          try {
            // Generate a unique and formatted train number
            const generateTrainNumber = (type: string, index: number): string => {
              const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
              const sequence = index.toString().padStart(3, '0');
              const typePrefix = type.toUpperCase().slice(0, 3);
              return `${typePrefix}${timestamp}${sequence}`;
            };

            // Validate train type before processing
            const mappedType = validateAndMapTrainType(trainType.type);
            
            // Generate unique train number with retry logic
            let trainNumber: string;
            let retryCount = 0;
            const maxRetries = 3;

            do {
              trainNumber = generateTrainNumber(mappedType, retryCount);
              const [existingTrain] = await tx
                .select()
                .from(trains)
                .where(eq(trains.trainNumber, trainNumber))
                .limit(1);

              if (!existingTrain) break;
              retryCount++;
            } while (retryCount < maxRetries);

            if (retryCount >= maxRetries) {
              throw new Error(`Failed to generate unique train number after ${maxRetries} attempts`);
            }

            const [newTrain] = await tx
              .insert(trains)
              .values({
                trainNumber,
                description: trainType.description,
                type: mappedType,
                maxSpeed: trainType.max_speed ?? null,
                priorityLevel: trainType.priority_level ?? null,
                features: trainType.features ?? []
              })
              .returning();

            results.success.push({
              originalType: trainType.type,
              mappedType,
              trainNumber,
              trainId: newTrain.id,
              description: newTrain.description,
              features: newTrain.features
            });
          } catch (error) {
            console.error("[API] Failed to import train type:", trainType, error);
            results.failures.push({
              trainType,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
      });

      console.log("[API] Train types import completed:", {
        total: result.data.train_types.length,
        successful: results.success.length,
        failed: results.failures.length,
        userId: req.user.id
      });

      const response = {
        success: true,
        data: {
          message: "Train types import completed",
          summary: {
            total: result.data.train_types.length,
            successful: results.success.length,
            failed: results.failures.length
          },
          successfulImports: results.success,
          failedImports: results.failures,
          metadata: {
            acceptedTypes: Object.values(TrainType),
            requiredFields: ["type", "description"],
            optionalFields: ["max_speed", "priority_level", "features"],
            timestamp: new Date().toISOString()
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("[API] Failed to import train types:", error);
      res.status(500).json({
        error: "Failed to import train types",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Schedules endpoint with proper table aliasing
  // Create schedule endpoint with validation and error handling
  app.post("/api/schedules", async (req, res) => {
    try {
      // Validate request body
      const scheduleSchema = z.object({
        trainId: z.number().min(1, "Train selection is required"),
        departureLocationId: z.number().min(1, "Departure location is required"),
        arrivalLocationId: z.number().min(1, "Arrival location is required"),
        scheduledDeparture: z.coerce.date(),
        scheduledArrival: z.coerce.date(),
        status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
        isCancelled: z.boolean().default(false),
        runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
        effectiveStartDate: z.coerce.date(),
        effectiveEndDate: z.coerce.date().nullable().optional(),
        detachLocationId: z.number().nullable().optional(),
        attachLocationId: z.number().nullable().optional(),
        detachTime: z.coerce.date().nullable().optional(),
        attachTime: z.coerce.date().nullable().optional(),
        attachTrainNumber: z.string().nullable().optional(),
        attachStatus: z.enum(['pending', 'completed', 'cancelled']).nullable().optional(),
        importantStations: z.array(z.object({
          locationId: z.number(),
          arrivalTime: z.string(),
          departureTime: z.string()
        })).optional()
      }).refine((data) => {
        if (data.detachTime && data.scheduledDeparture && data.scheduledArrival) {
          const detachDate = new Date(data.detachTime);
          const departureDate = new Date(data.scheduledDeparture);
          const arrivalDate = new Date(data.scheduledArrival);
          return detachDate >= departureDate && detachDate <= arrivalDate;
        }
        return true;
      }, {
        message: "Detach time must be between departure and arrival times",
        path: ["detachTime"]
      }).refine((data) => {
        if (data.attachTime && data.scheduledDeparture && data.scheduledArrival) {
          const attachDate = new Date(data.attachTime);
          const departureDate = new Date(data.scheduledDeparture);
          const arrivalDate = new Date(data.scheduledArrival);
          return attachDate >= departureDate && attachDate <= arrivalDate;
        }
        return true;
      }, {
        message: "Attach time must be between departure and arrival times",
        path: ["attachTime"]
      });

      const result = scheduleSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          error: "Invalid schedule data",
          details: result.error.issues
        });
      }

      // Verify train type for special operations
      const [train] = await db
        .select()
        .from(trains)
        .where(eq(trains.id, result.data.trainId))
        .limit(1);

      if (!train) {
        return res.status(404).json({
          error: "Train not found",
          message: "The specified train does not exist"
        });
      }

      // Validate special operations for SALOON and FTR trains
      if (train.type === 'saloon' || train.type === 'ftr') {
        // Validate attach location and train number together
        if (result.data.attachLocationId || result.data.attachTrainNumber || result.data.attachTime) {
          if (!result.data.attachLocationId || !result.data.attachTrainNumber || !result.data.attachTime) {
            return res.status(400).json({
              error: "Invalid attach configuration",
              message: "When specifying attach operations, all fields (location, train number, and time) are required"
            });
          }

          const [attachLocation] = await db
            .select()
            .from(locations)
            .where(eq(locations.id, result.data.attachLocationId))
            .limit(1);

          if (!attachLocation) {
            return res.status(404).json({
              error: "Invalid attach location",
              message: "The specified attach location does not exist"
            });
          }
        }

        // Validate detach location and time together
        if (result.data.detachLocationId || result.data.detachTime) {
          if (!result.data.detachLocationId || !result.data.detachTime) {
            return res.status(400).json({
              error: "Invalid detach configuration",
              message: "When specifying detach operations, both location and time are required"
            });
          }

          const [detachLocation] = await db
            .select()
            .from(locations)
            .where(eq(locations.id, result.data.detachLocationId))
            .limit(1);

          if (!detachLocation) {
            return res.status(404).json({
              error: "Invalid detach location",
              message: "The specified detach location does not exist"
            });
          }
        }
      } else if (result.data.attachLocationId || result.data.detachLocationId || result.data.attachTrainNumber) {
        return res.status(400).json({
          error: "Invalid train type for attach/detach operations",
          message: "Attach and detach operations are only available for SALOON and FTR trains"
        });
      }

      // Prepare schedule data with proper handling of special fields
      const scheduleData = {
        ...result.data,
        attachStatus: result.data.attachTrainNumber ? 'pending' : null,
      };

      const [newSchedule] = await db
        .insert(schedules)
        .values(scheduleData)
        .returning();

      // Fetch relations for the response
      const [scheduleWithRelations] = await db
        .select({
          id: schedules.id,
          trainId: schedules.trainId,
          departureLocationId: schedules.departureLocationId,
          arrivalLocationId: schedules.arrivalLocationId,
          scheduledDeparture: schedules.scheduledDeparture,
          scheduledArrival: schedules.scheduledArrival,
          status: schedules.status,
          detachLocationId: schedules.detachLocationId,
          attachLocationId: schedules.attachLocationId,
          detachTime: schedules.detachTime,
          attachTime: schedules.attachTime,
          attachTrainNumber: schedules.attachTrainNumber,
          attachStatus: schedules.attachStatus,
          train: {
            id: trains.id,
            trainNumber: trains.trainNumber,
            type: trains.type
          }
        })
        .from(schedules)
        .where(eq(schedules.id, newSchedule.id))
        .innerJoin(trains, eq(schedules.trainId, trains.id))
        .limit(1);

      // Return JSON response with full relations
      return res.json({
        success: true,
        data: scheduleWithRelations
      });
    } catch (error) {
      console.error("[API] Failed to create schedule:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create schedule",
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });
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
        detachLocationId: schedules.detachLocationId,
        attachLocationId: schedules.attachLocationId,
        detachTime: schedules.detachTime,
        attachTime: schedules.attachTime,
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

  
  // Schedule import/export endpoints
  app.post("/api/schedules/import", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const scheduleSchema = z.object({
        trainId: z.number().min(1, "Train selection is required"),
        departureLocationId: z.number().min(1, "Departure location is required"),
        arrivalLocationId: z.number().min(1, "Arrival location is required"),
        scheduledDeparture: z.string().transform(str => new Date(str)),
        scheduledArrival: z.string().transform(str => new Date(str)),
        status: z.enum(['scheduled', 'running', 'delayed', 'completed', 'cancelled']).default('scheduled'),
        isCancelled: z.boolean().default(false),
        runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
        effectiveStartDate: z.string().transform(str => new Date(str)),
        effectiveEndDate: z.string().nullable().optional(),
        detachLocationId: z.number().nullable().optional(),
        attachLocationId: z.number().nullable().optional(),
        detachTime: z.string().nullable().optional().transform(str => str ? new Date(str) : null),
        attachTime: z.string().nullable().optional().transform(str => str ? new Date(str) : null),
      }).refine((data) => {
        if (data.detachTime) {
          const detachDate = new Date(data.detachTime);
          const departureDate = new Date(data.scheduledDeparture);
          const arrivalDate = new Date(data.scheduledArrival);
          return detachDate >= departureDate && detachDate <= arrivalDate;
        }
        return true;
      }, {
        message: "Detach time must be between departure and arrival times",
        path: ["detachTime"]
      }).refine((data) => {
        if (data.attachTime) {
          const attachDate = new Date(data.attachTime);
          const departureDate = new Date(data.scheduledDeparture);
          const arrivalDate = new Date(data.scheduledArrival);
          return attachDate >= departureDate && attachDate <= arrivalDate;
        }
        return true;
      }, {
        message: "Attach time must be between departure and arrival times",
        path: ["attachTime"]
      });

      const schedulesArray = z.array(scheduleSchema);
      const result = schedulesArray.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid schedule data",
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const schedules_to_import = result.data;
      const results = {
        success: [] as any[],
        failures: [] as any[]
      };

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        for (const schedule of schedules_to_import) {
          try {
            // Verify train exists
            const [existingTrain] = await tx
              .select()
              .from(trains)
              .where(eq(trains.id, schedule.trainId))
              .limit(1);

            if (!existingTrain) {
              results.failures.push({
                schedule,
                error: `Train with ID ${schedule.trainId} not found`
              });
              continue;
            }

            // Verify locations exist
            const [departureLoc] = await tx
              .select()
              .from(locations)
              .where(eq(locations.id, schedule.departureLocationId))
              .limit(1);

            const [arrivalLoc] = await tx
              .select()
              .from(locations)
              .where(eq(locations.id, schedule.arrivalLocationId))
              .limit(1);

            if (!departureLoc || !arrivalLoc) {
              results.failures.push({
                schedule,
                error: "Invalid location IDs"
              });
              continue;
            }

            // Insert new schedule with proper date handling
            const scheduleToInsert = {
              ...schedule,
              scheduledDeparture: new Date(schedule.scheduledDeparture),
              scheduledArrival: new Date(schedule.scheduledArrival),
              effectiveStartDate: new Date(schedule.effectiveStartDate),
              effectiveEndDate: schedule.effectiveEndDate ? new Date(schedule.effectiveEndDate) : null
            };

            const [newSchedule] = await tx
              .insert(schedules)
              .values(scheduleToInsert)
              .returning();

            results.success.push(newSchedule);
          } catch (error) {
            results.failures.push({
              schedule,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
      });

      res.json({
        message: "Import completed",
        summary: {
          total: schedules_to_import.length,
          successful: results.success.length,
          failed: results.failures.length
        },
        results
      });
    } catch (error) {
      console.error("[API] Failed to import schedules:", error);
      res.status(500).json({
        error: "Failed to import schedules",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/schedules/export", requireRole(UserRole.Admin), async (req, res) => {
    try {
      // Get schedules with all required relationships
      const exportData = await db
        .select({
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
          attachTrainNumber: schedules.attachTrainNumber,
          attachLocationId: schedules.attachLocationId,
          attachTime: schedules.attachTime,
          attachStatus: schedules.attachStatus,
          detachLocationId: schedules.detachLocationId,
          detachTime: schedules.detachTime,
          importantStations: schedules.importantStations,
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
        .innerJoin(trains, eq(schedules.trainId, trains.id))
        .innerJoin(locations, eq(schedules.departureLocationId, locations.id))
        .innerJoin(arrivalLocations, eq(schedules.arrivalLocationId, arrivalLocations.id));

      res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      console.error("[API] Failed to export schedules:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export schedules",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });


// Analytics endpoints
app.get("/api/analytics/schedule-metrics", async (req, res) => {
  try {
    const [metrics] = await db
      .select({
        total: sql`COUNT(*)`,
        delayed: sql`SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END)`,
        cancelled: sql`SUM(CASE WHEN is_cancelled THEN 1 ELSE 0 END)`,
        completed: sql`SUM(CASE WHEN status = 'completed' AND actual_arrival IS NOT NULL THEN 1 ELSE 0 END)`
      })
      .from(schedules);

    const trainUtilization = await db
      .select({
        trainId: trains.id,
        trainNumber: trains.trainNumber,
        scheduleCount: sql`COUNT(${schedules.id})`
      })
      .from(trains)
      .leftJoin(schedules, eq(schedules.trainId, trains.id))
      .groupBy(trains.id, trains.trainNumber);

    const routePerformance = await db
      .select({
        departureId: locations.id,
        departureName: locations.name,
        totalTrips: sql`COUNT(${schedules.id})`,
        delayedTrips: sql`SUM(CASE WHEN ${schedules.status} = 'delayed' THEN 1 ELSE 0 END)`,
        completedTrips: sql`SUM(CASE WHEN ${schedules.status} = 'completed' AND ${schedules.actualArrival} IS NOT NULL THEN 1 ELSE 0 END)`,
        avgDelayMinutes: sql`AVG(CASE 
          WHEN ${schedules.status} = 'completed' AND ${schedules.actualArrival} IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (${schedules.actualArrival} - ${schedules.scheduledArrival})) / 60 
          ELSE NULL 
        END)`,
        peakHourTrips: sql`SUM(CASE 
          WHEN EXTRACT(HOUR FROM ${schedules.scheduledDeparture}) BETWEEN 7 AND 9 
               OR EXTRACT(HOUR FROM ${schedules.scheduledDeparture}) BETWEEN 16 AND 18
          THEN 1 
          ELSE 0 
        END)`
      })
      .from(locations)
      .leftJoin(schedules, eq(schedules.departureLocationId, locations.id))
      .where(sql`${schedules.status} = 'completed' OR ${schedules.status} = 'delayed' OR ${schedules.status} IS NULL`)
      .groupBy(locations.id, locations.name);

    res.json({
      overview: {
        total: Number(metrics?.total ?? 0),
        delayed: Number(metrics?.delayed ?? 0),
        cancelled: Number(metrics?.cancelled ?? 0),
        completed: Number(metrics?.completed ?? 0)
      },
      trainUtilization,
      routePerformance
    });
  } catch (error) {
    console.error("[API] Failed to fetch analytics metrics:", error);
    res.status(500).json({ error: "Failed to fetch analytics metrics" });
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
  app.get("/api/trains", async (req, res) => {
    try {
      console.log("[API] Fetching trains...");
      const allTrains = await db
        .select({
          id: trains.id,
          trainNumber: trains.trainNumber,
          type: trains.type,
          description: trains.description,
          maxSpeed: trains.maxSpeed,
          priorityLevel: trains.priorityLevel,
          features: trains.features
        })
        .from(trains)
        .orderBy(trains.trainNumber);

      // Format and validate the response data
      const formattedTrains = allTrains.map(train => {
        if (!train || typeof train.id !== 'number' || typeof train.trainNumber !== 'string') {
          console.error("[API] Invalid train data:", train);
          return null;
        }
        return {
          id: train.id,
          trainNumber: train.trainNumber,
          type: train.type || 'unknown',
          description: train.description || '',
          maxSpeed: train.maxSpeed || 0,
          priorityLevel: train.priorityLevel || 0,
          features: Array.isArray(train.features) ? train.features : []
        };
      }).filter(Boolean);

      console.log("[API] Found trains:", {
        count: formattedTrains.length,
        sample: formattedTrains[0]
      });

      // Send proper JSON response with validation
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        count: formattedTrains.length,
        data: formattedTrains
      });
    } catch (error) {
      console.error("[API] Failed to fetch trains:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch trains",
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

export default router;