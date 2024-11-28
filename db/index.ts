import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@db/schema";
import { type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { trains, locations, users } from "@db/schema";
import { TrainType, UserRole } from "@db/schema";
import { eq } from "drizzle-orm";
import { crypto } from '../server/auth';

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
  try {
    db = await createDbConnection();
    console.log("[Database] Database initialized successfully");
    await seedInitialData();
    return db;
  } catch (error) {
    console.error("[Database] Failed to initialize database:", error);
    throw error;
  }
}

// Make db available for import
export { db };

// Seed initial data
export async function seedInitialData() {
  if (!db) {
    console.error("[Database] Database not initialized");
    return false;
  }

  try {
    // Create initial admin user with known credentials
    const [existingAdmin] = await db.select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);
      
    if (!existingAdmin) {
      const hashedPassword = await crypto.hash('admin123');
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin' as const
      });
      console.log("[Database] Created admin user with credentials - username: admin, password: admin123");
    }
    // Admin user creation is sufficient for initial setup
    console.log("[Database] Initial setup completed");

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
