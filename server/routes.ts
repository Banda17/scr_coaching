import type { Express } from "express";
import { db } from "../db";
import { trains, locations, schedules } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
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

export function registerRoutes(app: Express) {
  // Trains
  app.get("/api/trains", async (req, res) => {
    const allTrains = await db.select().from(trains);
    res.json(allTrains);
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    const allLocations = await db.select().from(locations);
    res.json(allLocations);
  });

  // Schedules
  app.get("/api/schedules", async (req, res) => {
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
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const newSchedule = await db.insert(schedules).values(req.body).returning();
      res.json(newSchedule[0]);
    } catch (error) {
      res.status(400).json({ error: "Invalid schedule data" });
  // Import schedules from Excel
  app.post("/api/schedules/import", upload.single('file'), async (req, res) => {
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
    }
  });

  app.patch("/api/schedules/:id", async (req, res) => {
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

  app.delete("/api/schedules/:id", async (req, res) => {
    await db.delete(schedules).where(eq(schedules.id, parseInt(req.params.id)));
    res.status(204).send();
  });
}
