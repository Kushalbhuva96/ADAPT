import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Root health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount API router under both /api and /api/v1
app.use("/api", apiRouter);
app.use("/api/v1", apiRouter);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: {
      code: "NOT_FOUND",
      message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
});

// Global error handler
app.use(errorHandler);
