const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "capacitor://localhost",
  "http://localhost",
];

const configuredOrigins = (process.env.FRONTEND_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Capacitor's production WebViews use these local origins on iOS and Android.
// Keep them allowed even when FRONTEND_ORIGINS is set for the hosted web app.
const allowedOrigins = new Set([
  ...configuredOrigins,
  "capacitor://localhost",
  "http://localhost",
]);

module.exports = function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("Origin");
  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({
      message: "Request origin is not allowed",
      code: "ORIGIN_NOT_ALLOWED",
      origin: origin || null,
    });
  }

  next();
};

module.exports.allowedOrigins = allowedOrigins;
