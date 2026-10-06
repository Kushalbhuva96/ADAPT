import mongoose from "mongoose";
import dns from "node:dns";

// Resolve potential Windows DNS SRV lookup issues with MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e: any) {
  console.warn("[Database] Could not set custom DNS servers:", e.message);
}

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("FATAL: MONGODB_URI is not defined in backend/.env");
    throw new Error("Please provide the MongoDB Atlas connection string in backend/.env as MONGODB_URI.");
  }

  try {
    // Mask sensitive connection details for safe logging
    const safeUri = uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
    console.log(`[Database] Connecting to MongoDB Atlas (${safeUri})...`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log("[Database] Successfully connected to MongoDB Atlas.");

    mongoose.connection.on("error", (err) => {
      console.error("[Database] Runtime connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[Database] MongoDB disconnected. Reconnection will be attempted automatically.");
    });

  } catch (error: any) {
    console.error("[Database] Initial connection failure:", error?.message || error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log("[Database] Gracefully disconnected from MongoDB.");
  } catch (error: any) {
    console.error("[Database] Disconnect error:", error?.message || error);
  }
}
