const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const poolConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  }
  : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  };

const pool = new Pool(poolConfig);

let initialized = false;

async function initializeSchema() {
  if (initialized) return;

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_id VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deceased_flag BOOLEAN DEFAULT FALSE;
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS claimant_relationship VARCHAR(100);
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_type VARCHAR(100) NOT NULL DEFAULT 'LIFE_COVER';
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS deceased_document_type VARCHAR(20) NOT NULL DEFAULT 'ID';
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS passport_country VARCHAR(100);
    CREATE TABLE IF NOT EXISTS policy_members (
      id SERIAL PRIMARY KEY,
      policy_id VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      relationship VARCHAR(100) NOT NULL,
      date_of_birth DATE NOT NULL,
      cover_type VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Skip default user creation - test data is pre-seeded in Supabase
  // const nkosi = await pool.query("SELECT id FROM users WHERE email = $1", ["Nkosi_10@outlook.com"]);
  // if (!nkosi.rowCount) { ... }

  initialized = true;
}

async function connect() {
  try {
    await pool.query("SELECT NOW()");
    await initializeSchema();
    console.log(" Connected to PostgreSQL");
  } catch (error) {
    console.error(" PostgreSQL connection error:", error.message);
  }
}

connect();

async function createUser(user) {
  await initializeSchema();

  const {
    first_name,
    last_name,
    email,
    username,
    password,
    role,
    phone,
    date_of_birth,
    id_number,
    passport_number,
    country_of_issue,
  } = user;

  const existing = await findUserByEmail(email);
  if (existing) {
    return null;
  }

  const result = await pool.query(
    `
      INSERT INTO users (first_name, last_name, email, username, password, role, phone, date_of_birth, id_number, passport_number, country_of_issue)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, first_name, last_name, email, username, role, phone, date_of_birth, created_at
    `,
    [first_name, last_name, email, username, password, role || "ROLE_POLICYHOLDER", phone, date_of_birth, id_number, passport_number, country_of_issue]
  );

  return result.rows[0];
}

async function saveRegistrationOtp(email, codeHash) {
  await initializeSchema();
  return pool.query(
    `INSERT INTO registration_email_otps (email, code_hash, expires_at, attempts, last_sent_at, verified_at, consumed_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW(), NULL, NULL)
     ON CONFLICT (email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = NOW(),
       verified_at = NULL,
       consumed_at = NULL
     WHERE registration_email_otps.last_sent_at < NOW() - INTERVAL '60 seconds'
       AND registration_email_otps.consumed_at IS NULL
     RETURNING email`,
    [email, codeHash]
  );
}

async function verifyRegistrationOtp(email, codeHash) {
  await initializeSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      `SELECT code_hash, expires_at, attempts, consumed_at
       FROM registration_email_otps WHERE email = $1 FOR UPDATE`, [email]
    );
    const otp = selected.rows[0];
    if (!otp || otp.consumed_at || new Date(otp.expires_at) <= new Date() || otp.attempts >= 5) {
      if (otp && otp.attempts < 5 && !otp.consumed_at) {
        await client.query("UPDATE registration_email_otps SET attempts = attempts + 1 WHERE email = $1", [email]);
      }
      await client.query("COMMIT");
      return false;
    }
    if (otp.code_hash !== codeHash) {
      await client.query("UPDATE registration_email_otps SET attempts = attempts + 1 WHERE email = $1", [email]);
      await client.query("COMMIT");
      return false;
    }
    await client.query("UPDATE registration_email_otps SET verified_at = NOW() WHERE email = $1", [email]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createUserWithVerifiedEmailOtp(user) {
  await initializeSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verified = await client.query(
      `SELECT email FROM registration_email_otps
       WHERE email = $1 AND verified_at > NOW() - INTERVAL '15 minutes'
         AND consumed_at IS NULL FOR UPDATE`, [user.email]
    );
    if (!verified.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    const inserted = await client.query(
      `INSERT INTO users (first_name, last_name, email, username, password, role, phone, date_of_birth, id_number, passport_number, country_of_issue)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, first_name, last_name, email, username, role, phone, date_of_birth, created_at`,
      [user.first_name, user.last_name, user.email, user.username, user.password,
        user.role || "ROLE_POLICYHOLDER", user.phone, user.date_of_birth,
        user.id_number, user.passport_number, user.country_of_issue]
    );
    await client.query("UPDATE registration_email_otps SET consumed_at = NOW() WHERE email = $1", [user.email]);
    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findUserByEmail(email) {
  await initializeSchema();
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  await initializeSchema();
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, username, role, policy_id, deceased_flag FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function findUserByUsername(username) {
  await initializeSchema();
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0] || null;
}

async function createConversation({ user_id, title }) {
  await initializeSchema();
  const result = await pool.query(
    `
      INSERT INTO conversations (user_id, title, preview, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `,
    [user_id, title || "New Conversation", ""]
  );
  return result.rows[0];
}

async function getConversations(userId) {
  await initializeSchema();
  const result = await pool.query(
    "SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId]
  );
  return result.rows;
}

async function getMessages(conversationId) {
  await initializeSchema();
  const result = await pool.query(
    "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
    [conversationId]
  );
  return result.rows;
}

async function deleteConversation(conversationId, userId) {
  await initializeSchema();
  // Parameterized query — conversation id and user id come from JWT, never raw client input
  const result = await pool.query(
    "DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id",
    [conversationId, userId]
  );
  return result.rowCount > 0;
}

async function saveMessage({ conversation_id, sender, message }) {
  await initializeSchema();

  const result = await pool.query(
    `
      INSERT INTO messages (conversation_id, sender, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [conversation_id, sender, message]
  );

  await pool.query(
    `
      UPDATE conversations
      SET preview = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [message, conversation_id]
  );

  await pool.query(
    `
      UPDATE conversations
      SET title = $1
      WHERE id = $2
      AND title = 'New Conversation'
    `,
    [message.length > 40 ? `${message.substring(0, 40)}...` : message, conversation_id]
  );

  return result.rows[0];
}

module.exports = {
  pool,
  createUser,
  saveRegistrationOtp,
  verifyRegistrationOtp,
  createUserWithVerifiedEmailOtp,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  createConversation,
  getConversations,
  getMessages,
  saveMessage,
  deleteConversation,
};
