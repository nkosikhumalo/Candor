CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    id_number VARCHAR(50),
    passport_number VARCHAR(100),
    country_of_issue VARCHAR(100),
    -- ROLE_POLICYHOLDER | ROLE_BENEFICIARY
    role VARCHAR(50) DEFAULT 'ROLE_POLICYHOLDER',
    -- Stable policy identifier — used as policyId claim in JWT so Java's
    -- ProfileStore can resolve the correct policy profile on every request.
    policy_id VARCHAR(100),
    -- Deceased flag: when true, self-service is frozen and session
    -- pivots to Empathetic Claims Support mode (see requireRole.js).
    deceased_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    preview TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FNOL (First Notice of Loss) claim tickets
-- Created when a user initiates a death claim via chat.
-- status lifecycle: CLAIM_SUBMITTED_PENDING_REVIEW → UNDER_REVIEW → APPROVED | REJECTED
CREATE TABLE IF NOT EXISTS claims (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    policy_id           VARCHAR(100) NOT NULL,
    claim_type          VARCHAR(100) NOT NULL DEFAULT 'LIFE_COVER',
    deceased_document_type VARCHAR(20) NOT NULL DEFAULT 'ID',
    passport_country    VARCHAR(100),
    claimant_name       VARCHAR(255) NOT NULL,
    claimant_relationship VARCHAR(100),
    deceased_name       VARCHAR(255),
    deceased_id_number  VARCHAR(50),
    date_of_death       DATE,
    status              VARCHAR(100) DEFAULT 'CLAIM_SUBMITTED_PENDING_REVIEW',
    documents_validated BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents uploaded against a claim — one row per file
CREATE TABLE IF NOT EXISTS claim_documents (
    id           SERIAL PRIMARY KEY,
    claim_id     INTEGER REFERENCES claims(id) ON DELETE CASCADE,
    doc_type     VARCHAR(100) NOT NULL,   -- DEATH_CERTIFICATE | ID_DOCUMENT | BANK_STATEMENT | DHA_1663 | OTHER
    file_name    VARCHAR(255),
    mime_type    VARCHAR(100),
    is_valid     BOOLEAN,                 -- result of AI scan
    validation_notes TEXT,               -- AI feedback (mismatch reason, quality issues, etc.)
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Append-only audit trail — no UPDATE or DELETE ever issued against this table.
-- Written by both Java (AI/RAG events) and Node (auth/chat events).
CREATE TABLE IF NOT EXISTS audit_log (
    id                  SERIAL PRIMARY KEY,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id             VARCHAR(255),        -- subject from JWT (string, not FK — survives user deletes)
    policy_id           VARCHAR(100),
    role                VARCHAR(50),
    action              VARCHAR(100) NOT NULL,
    details             JSONB,               -- action-specific context as key/value
    escalation_triggered BOOLEAN DEFAULT FALSE,
    status              VARCHAR(50) DEFAULT 'APPROVED'
);
