import type { Express } from "express";
import { db, checkDbConnection } from "../db";
import { trains, locations, schedules, UserRole } from "@db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { setupAuth, requireRole } from "./auth";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Schema for Excel import validation
const excelRowSchema = z.object({
  trainNumber: z.string(),
  departureLocation: z.string(),
  arrivalLocation: z.string(),
  scheduledDeparture: z.string(),
  scheduledArrival: z.string(),
  status: z.string().default('scheduled')
});

// The import statements were moved to the top of the file
// The registerRoutes function is now properly defined and exported
// The analytics endpoints are reorganized within the function

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

  // Schedules
  app.get("/api/schedules", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const results = await db.select().from(schedules)
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

  app.post("/api/schedules", requireRole(UserRole.Admin, UserRole.Operator), async (req, res) => {
    try {
      const newSchedule = await db.insert(schedules).values({
      ...req.body,
      scheduledDeparture: new Date(req.body.scheduledDeparture),
      scheduledArrival: new Date(req.body.scheduledArrival),
      effectiveStartDate: new Date(req.body.effectiveStartDate),
      effectiveEndDate: req.body.effectiveEndDate ? new Date(req.body.effectiveEndDate) : null
    }).returning();
      res.json(newSchedule[0]);
    } catch (error) {
      res.status(400).json({ error: "Invalid schedule data" });
    }
  });

  // Import schedules from Excel
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
          const validatedRow = excelRowSchema.parse(row);

          // Find train by number
          const train = await db.select().from(trains)
            .where(eq(trains.trainNumber, validatedRow.trainNumber))
            .limit(1);

          // Find locations
          const departureLocation = await db.select().from(locations)
            .where(eq(locations.name, validatedRow.departureLocation))
            .limit(1);
          
          const arrivalLocation = await db.select().from(locations)
            .where(eq(locations.name, validatedRow.arrivalLocation))
            .limit(1);

          if (!train[0] || !departureLocation[0] || !arrivalLocation[0]) {
            throw new Error(`Invalid references for row with train number ${validatedRow.trainNumber}`);
          }

          // Create schedule
          await db.insert(schedules).values({
            trainId: train[0].id,
            departureLocationId: departureLocation[0].id,
            arrivalLocationId: arrivalLocation[0].id,
            scheduledDeparture: new Date(validatedRow.scheduledDeparture),
            scheduledArrival: new Date(validatedRow.scheduledArrival),
            status: validatedRow.status,
            isCancelled: false
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
}