import type { Express } from "express";
import { db } from "../db";
import { trains, locations, schedules } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

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
