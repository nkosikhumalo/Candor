// Exposes authenticated Java API routes to the deployed Node BFF.
// Run cloudflared against this bridge (port 8090), never directly against Java.
const http = require("node:http");

const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const bridge = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (!allowedMethods.has(req.method) || !pathname.startsWith("/api/") || pathname === "/api/dev" || pathname.startsWith("/api/dev/")) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ message: "Not found" }));
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    res.writeHead(401, { "content-type": "application/json" });
    return res.end(JSON.stringify({ message: "Bearer token required" }));
  }

  const headers = {
    "content-type": req.headers["content-type"] || "application/json",
    authorization,
  };
  if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];

  const upstream = http.request(
    { hostname: "127.0.0.1", port: 8080, path: req.url, method: req.method, headers },
    (response) => {
      res.writeHead(response.statusCode || 502, {
        "content-type": response.headers["content-type"] || "application/json",
        "cache-control": "no-store",
      });
      response.pipe(res);
    }
  );

  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Local Java service is unavailable" }));
    }
  });
  req.pipe(upstream);
});

bridge.listen(8090, "127.0.0.1", () => {
  console.log("RAG-only Java bridge listening on 127.0.0.1:8090");
});
