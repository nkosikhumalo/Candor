/** Cookie-backed JWT authentication. The browser never receives the token in JavaScript. */
const jwt = require("jsonwebtoken");
const { sessionCookieName } = require("./sessionCookie");

module.exports = function authenticate(req, res, next) {
    const token = req.cookies?.[sessionCookieName];
    if (!token) {
        return res.status(401).json({ message: "Unauthenticated" });
    }

    const secret = process.env.JWT_SECRET || process.env.MOCK_JWT_SIGNING_SECRET;
    if (!secret) return res.status(503).json({ message: "Authentication is not configured" });

    try {
        const claims = jwt.verify(token, secret, {
            algorithms: ["HS256"],
            issuer: "https://companion.candor.local/mock-idp",
            audience: "candor-life-companion",
        });

        const rawRole = (claims.role || "").toLowerCase().replace(/^role_/, "");
        const normalizedRole =
            rawRole === "policy_holder" || rawRole === "policyholder"
                ? "ROLE_POLICYHOLDER"
                : rawRole === "beneficiary"
                    ? "ROLE_BENEFICIARY"
                    : `ROLE_${rawRole.toUpperCase()}`;

        req.authToken = token;
        req.user = {
            id: claims.id || claims.sub,
            role: normalizedRole,
            policyId: claims.policyId || claims.policy_id || null,
            membershipStatus: claims.membershipStatus || (normalizedRole === "ROLE_BENEFICIARY"
                ? "BENEFICIARY"
                : claims.policyId || claims.policy_id ? "MEMBER" : "PRE_MEMBER"),
            deceasedFlag: claims.deceasedFlag === true || claims.deceased_flag === true,
        };

        next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired session" });
    }
};
