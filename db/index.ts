import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@db/schema";
import { type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { trains, locations } from "@db/schema";
import { TrainType } from "@db/schema";

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function createDbConnection(retries = 5, delay = 5000): NeonDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  try {
    // Configure WebSocket before creating connection
    neonConfig.webSocketConstructor = ws;
    const db = drizzle(process.env.DATABASE_URL, { schema });
    console.log("[Database] Connection established successfully");
    return db;
  } catch (error) {
    if (retries > 0) {
      console.log(`[Database] Connection failed, retrying in ${delay/1000}s... (${retries} attempts remaining)`);
      return new Promise((resolve) => {
        setTimeout(() => resolve(createDbConnection(retries - 1, delay)), delay);
      }) as NeonDatabase<typeof schema>;
    } else {
      console.error("[Database] Failed to establish connection after multiple attempts");
      throw error;
    }
  }
}

// Initialize database connection
export const db = createDbConnection();

// Seed initial data
export async function seedInitialData() {
  try {
    // Add sample trains
    const sampleTrains = [
      { trainNumber: 'EXP101', description: 'Daily Express', type: TrainType.Express },
      { trainNumber: 'LOC201', description: 'Local Service', type: TrainType.Local },
      { trainNumber: 'FRT301', description: 'Cargo Transport', type: TrainType.Freight },
      { trainNumber: 'SPL401', description: 'Holiday Special', type: TrainType.Special },
    ];

    for (const train of sampleTrains) {
      await db.insert(trains).values(train).onConflictDoNothing();
    }
    console.log("[Database] Sample trains seeded successfully");

    // Add common stations
    const sampleLocations = [
      { name: 'Central Station', code: 'CTL' },
      { name: 'North Terminal', code: 'NTH' },
      { name: 'South Junction', code: 'STH' },
      { name: 'East Gateway', code: 'EST' },
      { name: 'West Port', code: 'WST' },
    ];

    for (const location of sampleLocations) {
      await db.insert(locations).values(location).onConflictDoNothing();
    }
    console.log("[Database] Sample locations seeded successfully");

    return true;
  } catch (error) {
    console.error("[Database] Seeding failed:", error);
    return false;
  }
}

// Add health check endpoint
export async function checkDbConnection() {
  try {
    await db.select().from(schema.trains).limit(1);
    return true;
  } catch (error) {
    console.error("[Database] Health check failed:", error);
    return false;
  }
}

// Run initial seeding
seedInitialData().catch(console.error);
