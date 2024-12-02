import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { schedules, type Schedule } from "@db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export function setupWebSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected");

    // Listen for schedule updates
    socket.on("updateSchedule", async (data: {
      id: number;
      status: string;
      actualDeparture?: string | null;
      actualArrival?: string | null;
      attachTrainNumber?: string | null;
      attachTime?: string | null;
      attachStatus?: 'pending' | 'completed' | 'cancelled' | null;
      detachLocationId?: number | null;
      detachTime?: string | null;
    }) => {
      try {
        // Update the schedule in database
        const updated = await db.update(schedules)
          .set({
            status: data.status,
            actualDeparture: data.actualDeparture ? new Date(data.actualDeparture) : null,
            actualArrival: data.actualArrival ? new Date(data.actualArrival) : null,
            attachTrainNumber: data.attachTrainNumber,
            attachTime: data.attachTime ? new Date(data.attachTime) : null,
            attachStatus: data.attachStatus,
            detachLocationId: data.detachLocationId,
            detachTime: data.detachTime ? new Date(data.detachTime) : null
          })
          .where(eq(schedules.id, data.id))
          .returning();

        if (updated.length > 0) {
          // Broadcast the update to all connected clients
          io.emit("scheduleUpdated", updated[0]);
        }
      } catch (error) {
        console.error("Error updating schedule:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  return io;
}
