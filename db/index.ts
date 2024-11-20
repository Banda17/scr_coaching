import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@db/schema";
import { type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { trains, locations, users } from "@db/schema";
import { TrainType, UserRole } from "@db/schema";
import { eq } from "drizzle-orm";

// Configure Neon to use the ws package
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

async function createDbConnection(retries = 5, delay = 5000): Promise<NeonDatabase<typeof schema>> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  try {
    neonConfig.webSocketConstructor = ws;
    const db = drizzle(process.env.DATABASE_URL, { schema });
    console.log("[Database] Connection established successfully");
    return db;
  } catch (error) {
    if (retries > 0) {
      console.log(`[Database] Connection failed, retrying in ${delay/1000}s... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return createDbConnection(retries - 1, delay);
    }
    console.error("[Database] Failed to establish connection after multiple attempts");
    throw error;
  }
}

// Initialize database instance
let db: NeonDatabase<typeof schema>;

export async function initializeDb() {
  db = await createDbConnection();
  await seedInitialData();
  return db;
}

// Make db available for import
export { db };

// Seed initial data
export async function seedInitialData() {
  try {
    // Create initial admin user
    const adminPassword = await import('crypto').then(crypto => 
      crypto.randomBytes(8).toString('hex')
    );
    
    const [existingAdmin] = await db.select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);
      
    if (!existingAdmin) {
      await db.insert(users).values({
        username: 'admin',
        password: await import('./auth').then(auth => auth.crypto.hash(adminPassword)),
        role: 'admin'
      });
      console.log("[Database] Created admin user with password:", adminPassword);
    }
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
