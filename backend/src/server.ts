import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log("=========================================");
    console.log("       ADAPT Backend Initialization       ");
    console.log("=========================================");

    // Verify and connect to MongoDB Atlas
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`[Server] ADAPT API server listening on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log("[Server] Shutdown complete.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error: any) {
    console.error("[Server] Fatal startup error:", error?.message || error);
    process.exit(1);
  }
}

bootstrap();
