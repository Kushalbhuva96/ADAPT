import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (typeof err?.code === "string" && err.code.startsWith("AI_")) {
    const upstream = err.upstreamStatus ?? err.upstreamStatusName ?? "unknown";
    console.error(`[AI] ${err.category || "service"} failure (${err.code}); upstream status ${upstream}.`);
  } else {
    console.error(`[Error] ${req.method} request failed (${err?.code || err?.status || "SERVER_ERROR"}).`);
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({
      success: false,
      message,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: err.errors,
      },
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const isAIError = typeof err.code === "string" && err.code.startsWith("AI_");
  const message = isAIError || statusCode < 500
    ? (err.message || "An unexpected server error occurred.")
    : "An unexpected server error occurred.";

  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: {
      code: err.code || "SERVER_ERROR",
      message,
      retryable: isAIError && ["provider_unavailable", "network", "timeout"].includes(err.category),
    },
  });
}
