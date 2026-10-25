#!/usr/bin/env node
/**
 * Seed script to create 12 test accounts in Supabase
 * Run: node scripts/seed-accounts.js
 */

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Use local database for seeding via Unix socket (peer authentication)
// This works when running on the same machine as PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  database: process.env.DB_NAME || "candor",
  // Use Unix socket for peer auth instead of TCP
  host: "/var/run/postgresql",
});

const accounts = [
  {
    name: "Ntando Malwande Sibiya",
    phEmail: "ntando.sibiya.ph@candor.local",
    benEmail: "ntando.sibiya.ben@candor.local",
    password: "Ntando@2024",
    phPolicyId: "POL-NTANDO-001",
    benPolicyId: "POL-NTANDO-002",
  },
  {
    name: "Yolanda S'phesihle Mthembu",
    phEmail: "yolanda.mthembu.ph@candor.local",
    benEmail: "yolanda.mthembu.ben@candor.local",
    password: "Yolanda@2024",
    phPolicyId: "POL-YOLANDA-001",
    benPolicyId: "POL-YOLANDA-002",
  },
  {
    name: "Bophelo-Botle Makuzeni",
    phEmail: "bophelo.makuzeni.ph@candor.local",
    benEmail: "bophelo.makuzeni.ben@candor.local",
    password: "Bophelo@2024",
    phPolicyId: "POL-BOPHELO-001",
    benPolicyId: "POL-BOPHELO-002",
  },
  {
    name: "Likhona Tshemese",
    phEmail: "likhona.tshemese.ph@candor.local",
    benEmail: "likhona.tshemese.ben@candor.local",
    password: "Likhona@2024",
    phPolicyId: "POL-LIKHONA-001",
    benPolicyId: "POL-LIKHONA-002",
  },
  {
    name: "Nkosimphile Khumalo",
    phEmail: "nkosimphile.khumalo.ph@candor.local",
    benEmail: "nkosimphile.khumalo.ben@candor.local",
    password: "Nkosimphile@2024",
    phPolicyId: "POL-NKOSIMPHILE-001",
    benPolicyId: "POL-NKOSIMPHILE-002",
  },
  {
    name: "Kagiso Manoge Ntsoane",
    phEmail: "kagiso.ntsoane.ph@candor.local",
    benEmail: "kagiso.ntsoane.ben@candor.local",
    password: "Kagiso@2024",
    phPolicyId: "POL-KAGISO-001",
    benPolicyId: "POL-KAGISO-002",
  },
];

async function seedAccounts() {
  try {
    console.log("🔄 Connecting to database...");
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to database\n");

    console.log("🔄 Initializing schema...");
    const schema = fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8");
    await pool.query(schema);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status VARCHAR(30);
      UPDATE users SET membership_status = CASE
        WHEN upper(role) IN ('ROLE_BENEFICIARY', 'BENEFICIARY') THEN 'BENEFICIARY'
        WHEN NULLIF(btrim(policy_id), '') IS NOT NULL THEN 'MEMBER'
        ELSE 'PRE_MEMBER'
      END
      WHERE membership_status IS NULL OR btrim(membership_status) = '';
      ALTER TABLE users ALTER COLUMN membership_status SET DEFAULT 'PRE_MEMBER';
      ALTER TABLE users ALTER COLUMN membership_status SET NOT NULL;
    `);
    console.log("✅ Schema initialized\n");

    let createdCount = 0;
    const results = [];

    for (const account of accounts) {
      const [firstName, ...lastNameParts] = account.name.split(" ");
      const lastName = lastNameParts.join(" ");

      // Hash password once (same for both roles)
      const hashedPassword = await bcrypt.hash(account.password, 10);

      // Insert policyholder account
      const phResult = await pool.query(
        `INSERT INTO users 
         (first_name, last_name, email, username, password, role, policy_id, deceased_flag, membership_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, role, policy_id`,
        [
          firstName,
          lastName,
          account.phEmail,
          account.phEmail.split("@")[0],
          hashedPassword,
          "ROLE_POLICYHOLDER",
          account.phPolicyId,
          false,
          "MEMBER",
        ]
      );

      results.push({
        name: account.name,
        email: account.phEmail,
        role: "POLICYHOLDER",
        policyId: account.phPolicyId,
        password: account.password,
      });

      // Insert beneficiary account
      const benResult = await pool.query(
        `INSERT INTO users 
         (first_name, last_name, email, username, password, role, policy_id, deceased_flag, membership_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, role, policy_id`,
        [
          firstName,
          lastName,
          account.benEmail,
          account.benEmail.split("@")[0],
          hashedPassword,
          "ROLE_BENEFICIARY",
          account.benPolicyId,
          false,
          "BENEFICIARY",
        ]
      );

      results.push({
        name: account.name,
        email: account.benEmail,
        role: "BENEFICIARY",
        policyId: account.benPolicyId,
        password: account.password,
      });

      createdCount += 2;
      console.log(`✅ Created accounts for ${account.name}`);
    }

    console.log(`\n🎉 Successfully created ${createdCount} accounts!\n`);
    console.log("Account Details:");
    console.log("═".repeat(100));

    results.forEach((r) => {
      console.log(
        `${r.name} (${r.role}) | ${r.email} | ${r.policyId} | pwd: ${r.password}`
      );
    });

    console.log("═".repeat(100));
    console.log("\n✅ All accounts are ready to use!");

    await pool.end();
  } catch (error) {
    console.error("❌ Error seeding accounts:", error.message);
    await pool.end();
    process.exit(1);
  }
}

seedAccounts();
