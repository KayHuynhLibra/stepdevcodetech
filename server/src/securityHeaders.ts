import type { NextFunction, Request, Response } from "express";

/**
 * Security headers nhẹ — không phụ thuộc helmet.
 * CSP lỏng đủ cho SPA Vite + Google Fonts hiện tại.
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), interest-cohort=()",
  );
  // SPA: script/style self; fonts Google; connect same-origin + websocket
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }
  next();
}

export function warnOpenCorsIfProd(allowedOrigins: string[]) {
  const isProd =
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT;
  if (isProd && allowedOrigins.length === 0) {
    console.warn(
      "[security] ALLOWED_ORIGINS trống trên production — CORS đang mở mọi origin. " +
        "Set ALLOWED_ORIGINS=https://stepkay.codes (và domain phụ nếu có).",
    );
  }
}
