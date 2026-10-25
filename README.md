<p align="center">
  <img src="https://img.shields.io/badge/MEDICARE-111111?style=for-the-badge" alt="Medicare" />
  <img src="https://img.shields.io/badge/AI_COMPANION-E4032B?style=for-the-badge" alt="AI Companion" />
</p>

<h1 align="center">Medicare AI Companion</h1>

<p align="center"><strong>Simple support for life insurance, policies, and claims.</strong></p>

---

Medicare is a health-insurance support app. People can sign in, get help with policies and claims, send claim documents, update some policy details, and try premium changes with a calculator.

## Stack

| Area | Technologies |
| --- | --- |
| Web client | React 19, Vite 8, React Router, JavaScript, CSS |
| API and application data | Node.js, Express 5, PostgreSQL (`pg`) |
| RAG and business services | Java 21, Spring Boot 3.3, Spring Security, JDBC |
| RAG document store | SQLite (`sqlite-jdbc`) |
| Authentication | JWT, bcrypt, role-based authorization |
| Other client libraries | React Markdown, Capacitor |

## Architecture

```text
React + Vite web client
        │ HTTP / JSON
        ▼
Node.js + Express API ───── PostgreSQL
        │                    accounts, chat, claims
        ▼
Java + Spring Boot service ─ SQLite
                             policy chunks and RAG data
```

The web app sends requests to the Node API. Node handles sign-in and app data, and sends RAG and some business requests to Java. Java checks the JWT again and handles policy search, chat answers, and claims support.

## RAG and AI

RAG means **retrieval-augmented generation**. It helps the app answer questions using the policy guide. The Java service reads `Myriad_Technical_Guide.md`, splits it into smaller sections, and saves those sections in a local SQLite database (`policy_rag.db` by default). It also stores document versions and embedding data there.

When someone asks a question, the service finds up to eight related sections and gives them to the AI as context. In claims mode, it only searches sections tagged for death claims. Checks help keep answers within the app’s rules. If no AI provider is set up, the app shows a fallback message.

The current setting is `rag.use-mock=true`. This means RAG searches SQLite by keyword. The mock embedding client is for development and testing; it does not do meaning-based search. Java can also call an AI model when provider settings are added. Keep all passwords and API keys in environment variables. They are needed for AI-generated answers, but not to start the app locally.

## Requirements

- Node.js and npm
- Java 21
- Maven 3.9+
- PostgreSQL database

## Local development

### 1. Configure PostgreSQL and Node API

Create a PostgreSQL database, then create `companion-backend-node/.env` using the following values:

```dotenv
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/medicare_db
DATABASE_SSL=false
JWT_SECRET=replace-with-a-random-secret-at-least-32-bytes-long
FRONTEND_ORIGINS=http://localhost:5173
JAVA_SERVICE_URL=http://localhost:8080
```

The API initializes its schema from `companion-backend-node/database/schema.sql` on startup. `DATABASE_URL` can be used instead of the individual `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, and `DB_PORT` values. For hosted PostgreSQL, set the appropriate SSL configuration.

Start the Node API:

```bash
cd companion-backend-node
npm install
npm run dev
```

### 2. Configure and start the Java service

Set the same JWT signing secret in the Java process as `JWT_SECRET` (or `MOCK_JWT_SIGNING_SECRET`). Optional AI settings include `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. The RAG SQLite file is created at `policy_rag.db` by default; set `RAG_DB_PATH` to choose another location.

From the repository root:

```bash
cd companion-backend
mvn spring-boot:run
```

The Java service listens on port `8080` by default. Set `JAVA_SERVICE_URL` in the Node API if you use a different address.

### Hybrid deployment: hosted frontend and Node, local Java

The Vercel frontend and Render Node API can stay deployed while the Java RAG service runs on your computer. Render cannot call `localhost` on your computer, so expose a temporary HTTPS tunnel and point the Node service at it. Keep your computer awake while using the app; the tunnel URL changes when a quick tunnel restarts.

1. In `companion-backend/.env`, set `JWT_SECRET` to the same value configured on the deployed Node service and set `RAG_DB_PATH=./data/rag.db` to use the local prebuilt policy index. Keep the JWT secret local and in Render's environment settings only. Add `OPENROUTER_API_KEY` here too if local Java should call OpenRouter.
2. Start local Java:

   ```bash
   cd companion-backend
   ./start.sh
   ```

3. In another terminal, from the repository root, start the Java API bridge:

   ```bash
   node scripts/hybrid-java-bridge.js
   ```

4. Install `cloudflared` if needed, then start a quick tunnel to the bridge:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8090
   ```

   The bridge forwards authenticated `/api/**` requests so the deployed Node BFF can use the local Java RAG, claims-document, what-if, and self-service endpoints. It blocks `/api/dev/**` token-issuing routes and does not expose Java's actuator endpoints.

5. In the Render dashboard, set the Node service's `JAVA_SERVICE_URL` to the HTTPS `trycloudflare.com` URL printed by `cloudflared`, then redeploy the Node service. Leave the Vercel API rewrite pointing at the deployed Node service.

This setup is for development and presentations. It depends on your computer, Java process, and tunnel staying online. A named tunnel with a stable hostname avoids changing `JAVA_SERVICE_URL` after each restart.

### Presentation-only signup verification simulation

For a presentation where email delivery is unavailable, signup can display a clearly labeled simulated email-verification action. This does **not** send an email or verify mailbox ownership. To enable it, set `VITE_DEMO_EMAIL_VERIFICATION=true` in the frontend environment and `DEMO_EMAIL_VERIFICATION_BYPASS=true` in the Node service environment, then rebuild/redeploy the frontend and restart/redeploy Node. Turnstile remains required. Keep both settings false or unset for real users and remove the temporary settings after the presentation. The Node flag is required because the server enforces signup verification; the frontend flag alone cannot register an account.

### 3. Start the web client

Create `companion-frontend/.env`:

```dotenv
VITE_API_BASE=http://localhost:5000
```

Then run:

```bash
cd companion-frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Project layout

```text
companion-frontend/       React and Vite web client
companion-backend-node/   Express API, authentication, and PostgreSQL access
companion-backend/        Spring Boot service, RAG, and business logic
  src/main/resources/
    Myriad_Technical_Guide.md  Source document loaded by RAG
```

## Features

- Sign-in, registration, JWT session handling, and role-based access control
- Policy and claims support through grounded policy-document retrieval
- Claims document upload and validation
- Self-service policy updates for eligible users
- Premium what-if calculations
- Chat conversation and message persistence
- English and Sesotho UI text, theme preferences, and browser speech features

## Security notes

- See [`SECURITY.md`](SECURITY.md) for the request-by-request security flow, controls, known gaps, and deployment checklist.
- Use long, random JWT secrets and keep them out of source control.
- Use HTTPS in deployed environments and restrict `FRONTEND_ORIGINS` to the client origins you operate.
- Keep database and AI provider credentials in environment configuration.
- The repository includes development-oriented mock identity and embedding behavior; configure and review identity and AI provider settings before production use.
