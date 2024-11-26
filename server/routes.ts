import type { Express } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db";
import { schedules, trains, locations, users } from "@db/schema";
import { eq, sql, and, gte, lte, or } from "drizzle-orm";
import { requireRole, setupAuth } from "./auth";
import { UserRole } from "@db/schema";
import { crypto } from "./auth";
import * as z from "zod";


const upload = multer();

export function registerRoutes(app: Express) {
  // Setup authentication routes
  setupAuth(app);
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const isDbHealthy = await checkDbConnection();
      if (isDbHealthy) {
        res.json({ status: "healthy", database: "connected" });
      } else {
        res.status(503).json({ status: "unhealthy", database: "disconnected" });
      }
    } catch (error) {
      res.status(500).json({ status: "error", message: "Failed to check database health" });
    }
  });

  // Trains
  app.get("/api/trains", async (req, res) => {
    try {
      const allTrains = await db.select().from(trains);
      res.json(allTrains);
    } catch (error) {
      console.error("[API] Failed to fetch trains:", error);
      res.status(500).json({ error: "Failed to fetch trains" });
    }
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    try {
      const allLocations = await db.select().from(locations);
      res.json(allLocations);
    } catch (error) {
      console.error("[API] Failed to fetch locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  // Delete location
  app.delete("/api/locations/:id", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      
      // Check if location exists and is not referenced by any schedules
      const [location] = await db.select().from(locations)
        .where(eq(locations.id, locationId))
        .limit(1);
      
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      // Check if location is referenced in schedules
      const schedulesWithLocation = await db.select()
        .from(schedules)
        .where(
          or(
            eq(schedules.departureLocationId, locationId),
            eq(schedules.arrivalLocationId, locationId)
          )
        )
        .limit(1);
      
      if (schedulesWithLocation.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete location",
          message: "Location is being used in existing schedules"
        });
      }
      
      // Delete the location
      await db.delete(locations)
        .where(eq(locations.id, locationId));
      
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("[API] Failed to delete location:", error);
      res.status(500).json({ error: "Failed to delete location" });
    }
  });
  // Import locations from Excel
  // Excel row validation schema with detailed error messages
  const locationImportSchema = z.object({
    name: z.string()
      .min(1, "Location name cannot be empty")
      .max(100, "Location name is too long (max 100 characters)")
      .refine(val => /^[a-zA-Z0-9\s.-]+$/.test(val), {
        message: "Location name can only contain letters, numbers, spaces, dots, and hyphens"
      }),
    code: z.string()
      .min(1, "Location code cannot be empty")
      .max(10, "Location code is too long (max 10 characters)")
      .refine(val => /^[A-Z0-9.-]+$/.test(val.toUpperCase()), {
        message: "Location code can only contain uppercase letters, numbers, dots, and hyphens"
      })
  });

  app.post("/api/locations/import", requireRole(UserRole.Admin), upload.single('file'), async (req, res) => {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: "File upload error",
        message: "No file was uploaded",
        code: "FILE_MISSING"
      });
    }

    // Validate file type
    if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
      return res.status(400).json({
        error: "Invalid file format",
        message: "Only Excel files (.xlsx or .xls) are allowed",
        code: "INVALID_FILE_FORMAT"
      });
    }

    try {
      // Attempt to read Excel file
      let workbook;
      try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      } catch (error) {
        return res.status(400).json({
          error: "Excel parsing error",
          message: "Failed to parse Excel file. Please ensure it's a valid Excel document",
          code: "EXCEL_PARSE_ERROR",
          details: error instanceof Error ? error.message : undefined
        });
      }

      // Validate workbook structure
      if (!workbook.SheetNames.length) {
        return res.status(400).json({
          error: "Invalid Excel format",
          message: "Excel file contains no sheets",
          code: "NO_SHEETS"
        });
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      // Validate rows existence
      if (!rows.length) {
        return res.status(400).json({
          error: "Empty file",
          message: "Excel file contains no data rows",
          code: "NO_DATA"
        });
      }

      let importedCount = 0;
      const errors: Array<{
        row: number;
        message: string;
        data?: any;
      }> = [];

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // Add 2 to account for header row and 1-based indexing
        const row = rows[i];

        try {
          // Validate row structure
          if (!row || typeof row !== 'object') {
            throw new Error("Invalid row format");
          }

          const validatedRow = locationImportSchema.parse(row);

          // Check for duplicate code
          const existingLocation = await db.select()
            .from(locations)
            .where(eq(locations.code, validatedRow.code.toUpperCase()))
            .limit(1);

          if (existingLocation.length > 0) {
            errors.push({
              row: rowNumber,
              message: `Location code '${validatedRow.code}' already exists`,
              data: { code: validatedRow.code }
            });
            continue;
          }

          // Create location
          await db.insert(locations).values({
            name: validatedRow.name.trim(),
            code: validatedRow.code.toUpperCase().trim()
          });

          importedCount++;
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof z.ZodError) {
            errorMessage = error.errors.map(e => e.message).join("; ");
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          errors.push({
            row: rowNumber,
            message: errorMessage,
            data: row
          });
        }
      }

      // Send detailed response
      return res.json({
        success: true,
        imported: importedCount,
        total: rows.length,
        errors: errors.length > 0 ? errors : undefined,
        summary: `Imported ${importedCount} out of ${rows.length} locations${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
      });

    } catch (error) {
      console.error("[Location Import] Error:", error);
      return res.status(500).json({
        error: "Import processing error",
        message: "Failed to process location import",
        code: "IMPORT_FAILED",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  // Schedules
  app.get("/api/schedules", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      type JoinedSchedule = {
        id: number;
        trainId: number | null;
        departureLocationId: number | null;
        arrivalLocationId: number | null;
        scheduledDeparture: Date;
        scheduledArrival: Date;
        actualDeparture: Date | null;
        actualArrival: Date | null;
        status: string;
        isCancelled: boolean;
        runningDays: boolean[];
        effectiveStartDate: Date;
        effectiveEndDate: Date | null;
        train: {
          id: number;
          trainNumber: string;
          type: string;
          description: string | null;
        } | null;
        departureLocation: {
          id: number;
          name: string;
          code: string;
        } | null;
        arrivalLocation: {
          id: number;
          name: string;
          code: string;
        } | null;
      };

      const arrival_locations = alias(locations, 'arrival_locations');
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
          id: arrival_locations.id,
          name: arrival_locations.name,
          code: arrival_locations.code
        }
      } satisfies Record<keyof JoinedSchedule, any>)
      .from(schedules)
      .leftJoin(trains, eq(schedules.trainId, trains.id))
      .leftJoin(locations, eq(schedules.departureLocationId, locations.id))
      .leftJoin(arrival_locations, eq(schedules.arrivalLocationId, arrival_locations.id))
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

// Check for schedule conflicts
async function checkScheduleConflicts(trainId: number, scheduledDeparture: Date, scheduledArrival: Date, effectiveStartDate: Date, effectiveEndDate: Date | null, runningDays: boolean[], excludeScheduleId?: number) {
  const overlappingSchedules = await db.select().from(schedules)
    .where(
      sql`
        train_id = ${trainId}
        AND is_cancelled = false
        AND (
          (scheduled_departure, scheduled_arrival) OVERLAPS 
          (${scheduledDeparture}, ${scheduledArrival})
        )
        AND (
          effective_start_date <= ${effectiveEndDate || sql`'9999-12-31'`}
          AND (effective_end_date IS NULL OR effective_end_date >= ${effectiveStartDate})
        )
        ${excludeScheduleId ? sql`AND id != ${excludeScheduleId}` : sql``}
      `
    );

  // Check running days overlap
  return overlappingSchedules.filter(schedule => {
    // If either schedule runs on any of the same days, there's a potential conflict
    return schedule.runningDays.some((runs: boolean, index: number) => 
      runs && runningDays[index]
    );
  });
}
  app.post("/api/schedules", requireRole(UserRole.Admin, UserRole.Operator), async (req, res) => {
    try {
      // Validate dates
      const scheduledDeparture = new Date(req.body.scheduledDeparture);
      const scheduledArrival = new Date(req.body.scheduledArrival);
      const effectiveStartDate = new Date(req.body.effectiveStartDate);
      const effectiveEndDate = req.body.effectiveEndDate ? new Date(req.body.effectiveEndDate) : null;

      if (isNaN(scheduledDeparture.getTime())) {
        return res.status(400).json({ 
          error: "Invalid scheduled departure date",
          field: "scheduledDeparture"
        });
      }

      if (isNaN(scheduledArrival.getTime())) {
        return res.status(400).json({ 
          error: "Invalid scheduled arrival date",
          field: "scheduledArrival"
        });
      }

      if (scheduledArrival <= scheduledDeparture) {
        return res.status(400).json({ 
          error: "Scheduled arrival must be after scheduled departure",
          fields: ["scheduledDeparture", "scheduledArrival"]
        });
      }

      if (isNaN(effectiveStartDate.getTime())) {
        return res.status(400).json({ 
          error: "Invalid effective start date",
          field: "effectiveStartDate"
        });
      }

      if (effectiveEndDate && isNaN(effectiveEndDate.getTime())) {
        return res.status(400).json({ 
          error: "Invalid effective end date",
          field: "effectiveEndDate"
        });
      }

      if (effectiveEndDate && effectiveEndDate <= effectiveStartDate) {
        return res.status(400).json({ 
          error: "Effective end date must be after effective start date",
          fields: ["effectiveStartDate", "effectiveEndDate"]
        });
      }

      // Check for schedule conflicts
      const conflicts = await checkScheduleConflicts(
        req.body.trainId,
        scheduledDeparture,
        scheduledArrival,
        effectiveStartDate,
        effectiveEndDate,
        req.body.runningDays
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: "Schedule conflict detected",
          details: "This train already has a schedule that overlaps with the proposed time and dates",
          conflicts: conflicts.map(c => ({
            id: c.id,
            scheduledDeparture: c.scheduledDeparture,
            scheduledArrival: c.scheduledArrival
          }))
        });
      }

      const newSchedule = await db.insert(schedules).values({
        ...req.body,
        scheduledDeparture,
        scheduledArrival,
        effectiveStartDate,
        effectiveEndDate
      }).returning();

      res.json(newSchedule[0]);
    } catch (error) {
      console.error("[API] Schedule creation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ 
          error: "Failed to create schedule",
          details: error.message
        });
      } else {
        res.status(500).json({ 
          error: "Internal server error",
          details: "An unexpected error occurred"
        });
      }
    }
  });

  // Import schedules from Excel
  const scheduleImportSchema = z.object({
    trainNumber: z.string().min(1, "Train number cannot be empty"),
    departureLocation: z.string().min(1, "Departure location cannot be empty"),
    arrivalLocation: z.string().min(1, "Arrival location cannot be empty"),
    scheduledDeparture: z.string().refine(val => !isNaN(new Date(val).getTime()), {message: "Invalid scheduled departure date"}),
    scheduledArrival: z.string().refine(val => !isNaN(new Date(val).getTime()), {message: "Invalid scheduled arrival date"}),
    status: z.string().optional()
  });
  app.post("/api/schedules/import", requireRole(UserRole.Admin), upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      // Read Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let importedCount = 0;
      const errors: string[] = [];

      // Process each row
      for (const row of rows) {
        try {
          const validatedRow = scheduleImportSchema.parse(row);

  // Selective table cleaning endpoint
  app.post("/api/admin/clean-tables", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const { tables } = req.body;

      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Please provide an array of table names to clean" 
        });
      }

      // Validate table names
      const validTables = ['schedules', 'trains', 'locations'];
      const invalidTables = tables.filter(table => !validTables.includes(table));
      
      if (invalidTables.length > 0) {
        return res.status(400).json({ 
          error: "Invalid tables", 
          message: `Invalid table names: ${invalidTables.join(', ')}`,
          validTables 
        });
      }

      // Begin transaction
      await db.transaction(async (tx) => {
        // Clean selected tables
        for (const table of tables) {
          switch (table) {
            case 'schedules':
              await tx.delete(schedules);
              break;
            case 'trains':
              await tx.delete(trains);
              break;
            case 'locations':
              await tx.delete(locations);
              break;
          }
        }
      });

      res.json({ 
        success: true, 
        message: `Successfully cleaned tables: ${tables.join(', ')}`
      });

    } catch (error) {
      console.error("[API] Table cleaning error:", error);
      res.status(500).json({ 
        error: "Failed to clean tables",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });
          // Find train by number
          const train = await db.select().from(trains)
            .where(eq(trains.trainNumber, validatedRow.trainNumber))
            .limit(1);

          if (!train[0]) {
            throw new Error(`Train number '${validatedRow.trainNumber}' not found`);
          }

          // Find locations
          const departureLocation = await db.select().from(locations)
            .where(eq(locations.name, validatedRow.departureLocation))
            .limit(1);
          
          if (!departureLocation[0]) {
            throw new Error(`Departure location '${validatedRow.departureLocation}' not found`);
          }

          const arrivalLocation = await db.select().from(locations)
            .where(eq(locations.name, validatedRow.arrivalLocation))
            .limit(1);

          if (!arrivalLocation[0]) {
            throw new Error(`Arrival location '${validatedRow.arrivalLocation}' not found`);
          }

          // Validate departure and arrival times
          const scheduledDeparture = new Date(validatedRow.scheduledDeparture);
          const scheduledArrival = new Date(validatedRow.scheduledArrival);

          if (scheduledArrival <= scheduledDeparture) {
            throw new Error('Scheduled arrival must be after scheduled departure');
          }

          // Create schedule
          await db.insert(schedules).values({
            trainId: train[0].id,
            departureLocationId: departureLocation[0].id,
            arrivalLocationId: arrivalLocation[0].id,
            scheduledDeparture,
            scheduledArrival,
            status: validatedRow.status,
            isCancelled: false,
            runningDays: Array(7).fill(true), // Default to running all days
            effectiveStartDate: new Date() // Default to current date
          });

          importedCount++;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }

      res.json({
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(400).json({
        error: "Failed to process Excel file",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  app.patch("/api/schedules/:id", requireRole(UserRole.Admin, UserRole.Operator), async (req, res) => {
    try {
      const updated = await db.update(schedules)
        .set(req.body)
        .where(eq(schedules.id, parseInt(req.params.id)))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/schedules/:id", requireRole(UserRole.Admin), async (req, res) => {
    await db.delete(schedules).where(eq(schedules.id, parseInt(req.params.id)));
    res.status(204).send();
  });

  // Analytics endpoints
  app.get("/api/analytics/schedule-metrics", async (req, res) => {
    try {
      const totalSchedules = await db
        .select({ count: sql<number>`count(*)` })
        .from(schedules);

      const delayedSchedules = await db
        .select({ count: sql<number>`count(*)` })
        .from(schedules)
        .where(eq(schedules.status, 'delayed'));

      const cancelledSchedules = await db
        .select({ count: sql<number>`count(*)` })
        .from(schedules)
        .where(eq(schedules.isCancelled, true));

      const trainUtilization = await db
        .select({
          trainId: trains.id,
          trainNumber: trains.trainNumber,
          scheduleCount: sql<number>`count(${schedules.id})`
        })
        .from(trains)
        .leftJoin(schedules, eq(trains.id, schedules.trainId))
        .groupBy(trains.id, trains.trainNumber);

      const routePerformance = await db
        .select({
          departureId: locations.id,
          departureName: locations.name,
          arrivalId: schedules.arrivalLocationId,
          totalTrips: sql<number>`count(${schedules.id})`,
          delayedTrips: sql<number>`sum(case when ${schedules.status} = 'delayed' then 1 else 0 end)`,
          avgDelayMinutes: sql<number>`avg(
            case when ${schedules.actualArrival} is not null 
            then extract(epoch from (${schedules.actualArrival} - ${schedules.scheduledArrival})) / 60 
            else 0 end
          )`,
          peakHourTrips: sql<number>`sum(
            case when extract(hour from ${schedules.scheduledDeparture}) between 7 and 9 
            or extract(hour from ${schedules.scheduledDeparture}) between 16 and 18
            then 1 else 0 end
          )`
        })
        .from(locations)
        .leftJoin(schedules, eq(locations.id, schedules.departureLocationId))
        .groupBy(locations.id, locations.name, schedules.arrivalLocationId);

      res.json({
        overview: {
          total: totalSchedules[0].count,
          delayed: delayedSchedules[0].count,
          cancelled: cancelledSchedules[0].count,
        },
        trainUtilization,
        routePerformance,
      });
    } catch (error) {
      console.error("[API] Failed to fetch analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Selective table cleaning endpoint
  app.post("/api/admin/clean-tables", requireRole(UserRole.Admin), async (req, res) => {
    try {
      const { tables } = req.body;

      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ 
          error: "Invalid input", 
          message: "Please provide an array of table names to clean" 
        });
      }

      // Validate table names
      const validTables = ['schedules', 'trains', 'locations'];
      const invalidTables = tables.filter(table => !validTables.includes(table));
      
      if (invalidTables.length > 0) {
        return res.status(400).json({ 
          error: "Invalid tables", 
          message: `Invalid table names: ${invalidTables.join(', ')}`,
          validTables 
        });
      }

      // Begin transaction
      await db.transaction(async (tx) => {
        // Clean selected tables
        for (const table of tables) {
          switch (table) {
            case 'schedules':
              await tx.delete(schedules);
              break;
            case 'trains':
              await tx.delete(trains);
              break;
            case 'locations':
              await tx.delete(locations);
              break;
          }
        }
      });

      res.json({ 
        success: true, 
        message: `Successfully cleaned tables: ${tables.join(', ')}`
      });

    } catch (error) {
      console.error("[API] Table cleaning error:", error);
      res.status(500).json({ 
        error: "Failed to clean tables",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });
}

async function checkDbConnection() {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    return false;
  }
}