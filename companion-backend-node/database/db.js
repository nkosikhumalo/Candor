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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status VARCHAR(30);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country_of_issue VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_id VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deceased_flag BOOLEAN DEFAULT FALSE;
    UPDATE users
      SET membership_status = CASE
        WHEN upper(role) IN ('ROLE_BENEFICIARY', 'BENEFICIARY') THEN 'BENEFICIARY'
        WHEN NULLIF(btrim(policy_id), '') IS NOT NULL THEN 'MEMBER'
        ELSE 'PRE_MEMBER'
      END
      WHERE membership_status IS NULL OR btrim(membership_status) = '';
    ALTER TABLE users ALTER COLUMN membership_status SET DEFAULT 'PRE_MEMBER';
    ALTER TABLE users ALTER COLUMN membership_status SET NOT NULL;
    UPDATE users
      SET username = COALESCE(
        NULLIF(trim(both '.' from lower(regexp_replace(concat_ws('.', first_name, last_name), '[^a-zA-Z0-9]+', '.', 'g'))), ''),
        'member'
      ) || '.' || id::text
      WHERE username IS NULL OR btrim(username) = '';
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username);
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);
    CREATE SEQUENCE IF NOT EXISTS users_id_seq;
    ALTER SEQUENCE users_id_seq OWNED BY users.id;
    ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);
    SELECT setval('users_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1), EXISTS (SELECT 1 FROM users));
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'p') THEN
        ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
      END IF;
    END $$;
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
    membership_status,
  } = user;

  const existing = await findUserByEmail(email);
  if (existing) {
    return null;
  }

  const result = await pool.query(
    `
      INSERT INTO users (first_name, last_name, email, username, password, role, phone, date_of_birth, id_number, passport_number, country_of_issue, membership_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, first_name, last_name, email, username, role, membership_status, phone, date_of_birth, created_at
    `,
    [first_name, last_name, email, username, password, role || "ROLE_POLICYHOLDER", phone, date_of_birth, id_number, passport_number, country_of_issue, membership_status || "PRE_MEMBER"]
  );

  return result.rows[0];
}

async function findUserByEmail(email) {
  await initializeSchema();
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  await initializeSchema();
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, username, role, membership_status, policy_id, deceased_flag FROM users WHERE id = $1",
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
  findUserByEmail,
  findUserById,
  findUserByUsername,
  createConversation,
  getConversations,
  getMessages,
  saveMessage,
  deleteConversation,
};
