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
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
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
      "[security] ALLOWED_ORIGINS trống trên production — set ALLOWED_ORIGINS " +
        "hoặc PUBLIC_ORIGIN (vd https://YOUR_DOMAIN). Không hardcode domain trong code.",
    );
  }
}

/** Origin CORS được phép. Prod: ưu tiên ALLOWED_ORIGINS; fallback PUBLIC_ORIGIN nếu có. */
export function resolveAllowedOrigins(raw: string[]): string[] {
  if (raw.length > 0) return raw;
  const isProd =
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT;
  if (!isProd) return [];
  const pub = String(process.env.PUBLIC_ORIGIN || "")
    .trim()
    .replace(/\/$/, "");
  return pub ? [pub] : [];
}

export function corsOriginOk(
  origin: string | undefined,
  allowed: string[],
): boolean {
  if (!origin) return true; // same-origin / curl / native
  if (allowed.length === 0) return true; // local/dev mở
  return allowed.includes(origin);
}
