import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;
const SHUTDOWN_GRACE_PERIOD_MS = 10_000;

async function bootstrap() {
  let databaseConnected = false;
  try {
    console.log("=========================================");
    console.log("       ADAPT Backend Initialization       ");
    console.log("=========================================");

    // Verify and connect to MongoDB Atlas
    await connectDatabase();
    databaseConnected = true;

    const server = app.listen(PORT, () => {
      console.log(`[Server] ADAPT API server listening on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

      const forceCloseTimer = setTimeout(() => {
        console.warn("[Server] Grace period elapsed; closing remaining HTTP connections.");
        server.closeAllConnections();
      }, SHUTDOWN_GRACE_PERIOD_MS);
      forceCloseTimer.unref();

      // Stop accepting new requests first, then let active requests finish.
      server.close(async (error) => {
        clearTimeout(forceCloseTimer);
        if (error) console.error("[Server] HTTP shutdown error:", error.message);
        if (databaseConnected) {
          databaseConnected = false;
          await disconnectDatabase();
        }
        console.log("[Server] Shutdown complete.");
        if (error) process.exitCode = 1;
      });
      // Close idle keep-alive sockets immediately; active requests still drain.
      server.closeIdleConnections();
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

  } catch (error: any) {
    console.error("[Server] Fatal startup error:", error?.message || error);
    if (databaseConnected) await disconnectDatabase();
    process.exitCode = 1;
  }
}

bootstrap();
