import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function createDbConnection(retries = 5, delay = 5000) {
  try {
    const db = drizzle({
      connection: process.env.DATABASE_URL,
      schema,
      ws: ws,
    });
    console.log("[Database] Connection established successfully");
    return db;
  } catch (error) {
    if (retries > 0) {
      console.log(`[Database] Connection failed, retrying in ${delay/1000}s... (${retries} attempts remaining)`);
      setTimeout(() => createDbConnection(retries - 1, delay), delay);
    } else {
      console.error("[Database] Failed to establish connection after multiple attempts");
      throw error;
    }
  }
}

export const db = createDbConnection();

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
