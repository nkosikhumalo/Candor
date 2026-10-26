const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const User = require("../models/userModel");
const { membershipStatusFor, normalizedPolicyId } = require("../services/membershipStatus");

const { sessionCookieName, sessionCookieOptions, clearSessionCookie } = require("../middleware/sessionCookie");
const COMMON_PASSWORD_PARTS = ["password", "qwerty", "letmein", "welcome", "admin", "medicare", "candor", "iloveyou", "123456"];

function passwordPolicyIssues(password) {
  if (typeof password !== "string") return ["enter a password"];
  const normalized = password.toLowerCase().replace(/[\W_]+/g, "");
  const issues = [];
  if (password.length < 12) issues.push("at least 12 characters");
  if (!/\p{Ll}/u.test(password)) issues.push("a lowercase letter");
  if (!/\p{Lu}/u.test(password)) issues.push("an uppercase letter");
  if (!/\p{N}/u.test(password)) issues.push("a number");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) issues.push("a symbol");
  if (COMMON_PASSWORD_PARTS.some((part) => normalized.includes(part))) issues.push("no common password words such as password, welcome, or MediCare");
  if (Buffer.byteLength(password, "utf8") > 72) issues.push("no more than 72 UTF-8 bytes");
  return issues;
}

function publicUser(user) {
  const policyId = normalizedPolicyId(user.policyId || user.policy_id);
  const role = user.role || "ROLE_POLICYHOLDER";
  const membershipStatus = membershipStatusFor({ ...user, role, policyId });
  return {
    id: user.id,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    username: user.username || "",
    role,
    membershipStatus,
    policyId,
    deceasedFlag: user.deceasedFlag === true || user.deceased_flag === true,
  };
}

function normalizeUsernamePart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function generateUsername(firstName, lastName) {
  const base = [normalizeUsernamePart(firstName), normalizeUsernamePart(lastName)]
    .filter(Boolean)
    .join(".")
    .slice(0, 90)
    .replace(/\.+$/g, "") || "user";

  let suffix = 1;
  while (suffix < 1000000) {
    const ending = suffix === 1 ? "" : `.${suffix}`;
    const username = `${base.slice(0, 100 - ending.length)}${ending}`;
    if (!(await User.findUserByUsername(username))) return username;
    suffix += 1;
  }
  throw new Error("Could not generate a unique username");
}

exports.register = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email: rawEmail,
      password,
      role,
      phone,
      date_of_birth,
    } = req.body;

    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const parsedPhone = typeof phone === "string" ? parsePhoneNumberFromString(phone) : null;
    if (!parsedPhone || !parsedPhone.isValid() || !parsedPhone.number.startsWith("+")) {
      return res.status(400).json({ message: "Enter a valid phone number with its country code." });
    }

    const passwordIssues = passwordPolicyIssues(password);
    if (passwordIssues.length) {
      return res.status(400).json({ message: "Password is too weak. Choose a stronger password." });
    }

    const emailExists = await User.findUserByEmail(email);
    if (emailExists) return res.status(400).json({ message: "Email already exists" });

    const username = await generateUsername(first_name, last_name);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalize to ROLE_POLICYHOLDER / ROLE_BENEFICIARY for DB storage
    const normalizedRole =
      role === "beneficiary" || role === "ROLE_BENEFICIARY"
        ? "ROLE_BENEFICIARY"
        : "ROLE_POLICYHOLDER";

    const user = await User.createUser({
      first_name,
      last_name,
      email,
      username,
      password: hashedPassword,
      role: normalizedRole,
      deceased_flag: false,
      phone: parsedPhone.number,
      date_of_birth,
      membership_status: "PRE_MEMBER",
      // policy_id auto-generated in userModel if not provided
    });

    if (!user) return res.status(409).json({ message: "Email already exists" });

    res.status(201).json({ message: "User created successfully", user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "That email or username is already in use." });
    }
    console.error("Registration failed:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const rawLoginIdentifier = typeof (req.body.identifier || req.body.email) === "string"
      ? (req.body.identifier || req.body.email).trim()
      : "";
    const isEmail = rawLoginIdentifier.includes("@") && !rawLoginIdentifier.startsWith("@");
    const loginIdentifier = rawLoginIdentifier.replace(/^@/, "").toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: "Email/username and password are required" });
    }

    const user = isEmail
      ? await User.findUserByEmail(loginIdentifier)
      : await User.findUserByUsername(loginIdentifier);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ message: "Invalid credentials" });

    const secret = process.env.JWT_SECRET || process.env.MOCK_JWT_SIGNING_SECRET;
    if (!secret) {
      console.error("JWT_SECRET / MOCK_JWT_SIGNING_SECRET is not configured");
      return res.status(500).json({ message: "Auth misconfigured" });
    }

    const javaRole = (user.role || "ROLE_POLICYHOLDER").replace(/^ROLE_/, "");
    const policyId = normalizedPolicyId(user.policy_id);
    const subject = `user-${javaRole.toLowerCase()}-${user.id}`;

    // The BFF signs the same issuer/audience/role claims Java validates. The
    // JWT is only placed in an HttpOnly cookie and is never returned to JS.
    const token = jwt.sign(
      {
        id: user.id,
        role: javaRole,
        policyId,
        membershipStatus: membershipStatusFor(user),
        deceasedFlag: !!user.deceased_flag,
        authTime: Math.floor(Date.now() / 1000),
      },
      secret,
      {
        algorithm: "HS256",
        subject,
        issuer: "https://companion.candor.local/mock-idp",
        audience: "candor-life-companion",
        expiresIn: "15m",
      }
    );

    res.cookie(sessionCookieName, token, sessionCookieOptions());
    res.set("Cache-Control", "no-store");
    res.json({ message: "Login successful", user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};


const MAX_SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;

exports.refresh = (req, res) => {
  const token = req.cookies?.[sessionCookieName];
  const secret = process.env.JWT_SECRET || process.env.MOCK_JWT_SIGNING_SECRET;
  if (!token || !secret) {
    clearSessionCookie(res);
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }

  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "https://companion.candor.local/mock-idp",
      audience: "candor-life-companion",
      ignoreExpiration: true,
    });
    const authTime = Number(claims.authTime || claims.iat);
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = authTime + MAX_SESSION_AGE_SECONDS - now;
    if (!authTime || remainingSeconds <= 0 || !claims.sub) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    const refreshedToken = jwt.sign({
      id: claims.id,
      role: claims.role,
      policyId: claims.policyId || null,
      membershipStatus: membershipStatusFor({ role: claims.role, policyId: claims.policyId, membershipStatus: claims.membershipStatus }),
      deceasedFlag: claims.deceasedFlag === true,
      authTime,
    }, secret, {
      algorithm: "HS256",
      subject: claims.sub,
      issuer: "https://companion.candor.local/mock-idp",
      audience: "candor-life-companion",
      expiresIn: "15m",
    });

    res.cookie(sessionCookieName, refreshedToken, sessionCookieOptions(remainingSeconds * 1000));
    res.set("Cache-Control", "no-store");
    return res.status(204).end();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
};

exports.session = async (req, res) => {
  try {
    const user = await User.findUserById(req.user.id);
    if (!user) return res.status(401).json({ message: "Invalid or expired session" });
    res.set("Cache-Control", "no-store");
    res.json({ user: publicUser(user) });
  } catch {
    res.status(500).json({ message: "Unable to restore session" });
  }
};

exports.logout = (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
};
