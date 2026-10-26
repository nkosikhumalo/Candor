/**
 * Proxy Service — forwards BFF-approved requests to the Java microservice.
 *
 * Authorization header is passed through so Java can validate independently.
 * conversationId is merged into the body so Java's SessionMemoryStore keys
 * history to the correct chat thread across stateless requests.
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

function resolveJavaTarget() {
    const isProduction = process.env.NODE_ENV === "production";
    const configuredUrl = process.env.JAVA_SERVICE_URL?.trim();

    if (isProduction && !configuredUrl) {
        throw new Error("JAVA_SERVICE_URL must be set to the deployed Java service URL in production.");
    }

    if (configuredUrl) {
        try {
            const u = new URL(configuredUrl);
            if (!["http:", "https:"].includes(u.protocol)) {
                throw new Error("URL must use HTTP or HTTPS");
            }
            if (isProduction && (u.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(u.hostname))) {
                throw new Error("Production JAVA_SERVICE_URL must be a public HTTPS URL");
            }
            return {
                protocol: u.protocol,
                host: u.hostname,
                port: parseInt(u.port || (u.protocol === "https:" ? "443" : "80"), 10),
            };
        } catch (err) {
            if (isProduction) {
                throw new Error(`Invalid production JAVA_SERVICE_URL: ${err.message}`);
            }
            console.warn("[proxy] Invalid JAVA_SERVICE_URL, falling back to host/port:", err.message);
        }
    }

    if (isProduction) {
        throw new Error("Production Node service cannot use the local Java fallback. Set JAVA_SERVICE_URL.");
    }

    return {
        protocol: "http:",
        host: process.env.JAVA_SERVICE_HOST || "localhost",
        port: parseInt(process.env.JAVA_SERVICE_PORT || "8080", 10),
    };
}

const JAVA = resolveJavaTarget();
const javaRequest = JAVA.protocol === "https:" ? https.request : http.request;

/**
 * Proxy a JSON req → Java at `path`, pipe the response back to `res`.
 */
function proxyToJava(req, res, path) {
    const body = req.body || {};
    const conversationId =
        body.conversationId ||
        req.query.conversationId ||
        (req.user ? `${req.user.id}::${req.user.policyId || "unknown"}` : null);

    const forwardBody = JSON.stringify(
        conversationId ? { ...body, conversationId } : body
    );

    const options = {
        hostname: JAVA.host,
        port: JAVA.port,
        path,
        method: req.method,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(forwardBody),
            Authorization: req.authToken ? `Bearer ${req.authToken}` : "",
        },
    };

    const proxyReq = javaRequest(options, (proxyRes) => {
        if (proxyRes.statusCode === 401) {
            console.warn(`[proxy] Java service rejected the forwarded token for ${path}`);
            proxyRes.resume();
            return res.status(502).json({
                message: "The AI service could not validate the session token. Your Candor sign-in is still active.",
                code: "UPSTREAM_AUTH_ERROR",
            });
        }
        if (proxyRes.statusCode === 429) {
            const retryAfter = proxyRes.headers["retry-after"] || "not provided";
            let responseBody = "";
            proxyRes.on("data", (chunk) => {
                if (responseBody.length < 512) responseBody += chunk.toString().slice(0, 512 - responseBody.length);
            });
            proxyRes.on("end", () => {
                console.warn(`[proxy] Java returned HTTP 429 path=${path} retryAfter=${retryAfter} body=${responseBody || "<empty>"}`);
            });
            if (proxyRes.headers["retry-after"]) {
                res.setHeader("Retry-After", proxyRes.headers["retry-after"]);
            }
        }
        res.status(proxyRes.statusCode);
        // Ensure JSON responses are readable by the browser CORS stack
        const contentType = proxyRes.headers["content-type"];
        if (contentType) res.setHeader("Content-Type", contentType);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
        console.error(`[proxy] Java microservice unreachable (${JAVA.host}:${JAVA.port}): ${err.message}`);
        res.status(502).json({ message: "Upstream service unavailable", detail: err.message });
    });

    proxyReq.write(forwardBody);
    proxyReq.end();
}

/**
 * Proxy a multipart upload → Java at `path`.
 * Reconstructs a multipart body from multer's parsed file + fields,
 * then calls `onResponse(parsedJson)` with Java's JSON reply instead of
 * piping — so the caller can persist results to Postgres before responding.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {string}  path       Java endpoint path
 * @param {Function} onResponse callback(javaResponseJson)
 */
function proxyMultipartToJava(req, res, path, onResponse) {
    // Re-encode as multipart/form-data for Java
    const boundary = "----BFFBoundary" + Date.now();
    const chunks = [];

    // Append text fields
    const fields = req.body || {};
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
            )
        );
    }

    // Append the file part only if present
    if (req.file) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${req.file.originalname}"\r\nContent-Type: ${req.file.mimetype}\r\n\r\n`
            )
        );
        chunks.push(req.file.buffer);
        chunks.push(Buffer.from(`\r\n`));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(chunks);
    const options = {
        hostname: JAVA.host,
        port: JAVA.port,
        path,
        method: "POST",
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length,
            Authorization: req.authToken ? `Bearer ${req.authToken}` : "",
        },
    };

    const proxyReq = javaRequest(options, (proxyRes) => {
        let raw = "";
        proxyRes.on("data", (chunk) => { raw += chunk; });
        proxyRes.on("end", () => {
            try {
                onResponse(JSON.parse(raw));
            } catch {
                res.status(502).json({ message: "Invalid response from document validator.", raw });
            }
        });
    });

    proxyReq.on("error", (err) => {
        console.error(`[proxy-multipart] Java unreachable (${JAVA.host}:${JAVA.port}): ${err.message}`);
        res.status(502).json({ message: "Upstream service unavailable", detail: err.message });
    });

    proxyReq.write(body);
    proxyReq.end();
}

module.exports = { proxyToJava, proxyMultipartToJava };
