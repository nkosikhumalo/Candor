# Report 2 — System Analysis and Design

## SDLC phase

Requirements analysis, architecture, and detailed system design.

## System architecture

```text
React / Vite browser
        │ HTTPS, JSON, session cookie
        ▼
Node.js / Express API ───── PostgreSQL
        │                     accounts and app data
        ├── Turnstile Siteverify
        ├── Redis ─────────── short-lived signup proof
        ▼
Java / Spring Boot ───────── SQLite RAG index
        ├── policy retrieval and AI provider calls
        ├── deterministic what-if calculations
        └── local SMTP sender for the hybrid presentation setup
```

The browser calls Node for registration and login. Node remains the account-creation authority and verifies Turnstile. Requests for OTP delivery and code verification pass through Node to Java. Java sends the email and stores OTP state in Redis; after a correct code, it writes a short-lived `signup-email:verified:<email-hash>` marker. Node checks that marker before creating the account. The browser never receives Redis credentials or the mail password.

Code references: [Node auth routes](companion-backend-node/routes/authRoutes.js), [Node OTP proxy controller](companion-backend-node/controllers/emailOtpController.js), [Java proxy](companion-backend-node/services/proxyService.js), [Java OTP controller](companion-backend/src/main/java/com/candor/companion/email/EmailOtpController.java), and [Java OTP service](companion-backend/src/main/java/com/candor/companion/email/EmailOtpService.java).

For policy chat and calculations, Node forwards approved requests to Java. Java applies its own JWT and role rules. The RAG service searches policy chunks in SQLite and supplies retrieved context to the configured model. The what-if service calculates supported outputs in backend code; the model is not the calculator.

Related code: [RAG controller](companion-backend/src/main/java/com/candor/companion/web/RagController.java), [retrieval service](companion-backend/src/main/java/com/candor/companion/rag/RagRetrievalService.java), [security rules](companion-backend/src/main/java/com/candor/companion/security/SecurityConfig.java), and [what-if calculator](companion-backend/src/main/java/com/candor/companion/whatif/WhatIfCalculationService.java).

## Design decisions

### Email verification

- Use a six-digit code with a five-minute lifetime.
- Store an HMAC of the email and code, not the plain code.
- Normalize email consistently before hashing and lookups.
- Limit resend frequency, total sends per hour, and incorrect attempts.
- Expire the post-verification marker after ten minutes and delete it after successful account creation.
- Keep the signup sequence explicit: send code → enter code → verify → complete Turnstile → register.

### Separation of responsibilities

- **Node:** validates signup input, checks whether the email already has an account, verifies the Redis marker, checks Turnstile, and creates the account.
- **Java:** generates and verifies OTP codes, sends mail, and owns policy/RAG/calculation operations.
- **Redis:** provides shared short-lived state across the independently running Node and Java processes.
- **Frontend:** collects the email and code and displays progress; it cannot declare verification successful on its own.

### AI and policy assistance

RAG is used to retrieve relevant guide sections before generation. The response should be concise and organized for display as headings, paragraphs, and lists. When the request is a supported calculation, the application should guide the user into the what-if flow, which calls a dedicated backend endpoint. Unsupported eligibility conclusions should remain clearly qualified.

### Hybrid hosting

The deployed Node service cannot use `localhost` to reach Java on a developer computer. The design therefore uses an HTTPS Cloudflare Tunnel endpoint configured as Node’s `JAVA_SERVICE_URL`. The local Java listener must use the tunnel’s target port, and the same Redis database URL must be configured in Node and Java.

## Newly surfaced integration issue and resolution design

The email-OTP integration exposed a deployment issue that was not part of the original signup flow: Redis activity showed that the hosted Node service stored OTP data, but no code reached the mailbox and Node had no corresponding mail-delivery log. The earlier implementation sent Gmail SMTP directly from the hosted Node process. SMTP egress restrictions in that hosting environment prevented reliable delivery.

The resolution was to move SMTP sending and OTP verification into the local Java service for the presentation setup, while retaining Node as the signup gate and sharing the verification marker through Redis. This keeps the real user-entered-code requirement and avoids trusting a browser flag. See the [Node OTP proxy](companion-backend-node/controllers/emailOtpController.js), [Java OTP service](companion-backend/src/main/java/com/candor/companion/email/EmailOtpService.java), and [signup verification middleware](companion-backend-node/middleware/requireVerifiedEmail.js). The full delivery path still depends on valid local mail configuration and a running tunnel; see Report 4 for verification status.

## Design risks and controls

- **Tunnel exposure:** use HTTPS and the existing bridge/proxy arrangement; do not expose development token-issuing or management endpoints.
- **Email abuse:** apply resend cooldown, per-email hourly limits, and verification-attempt limits. Turnstile remains mandatory at account registration.
- **Secret leakage:** keep Gmail, Redis, JWT, Turnstile, and AI-provider secrets in server environment configuration only.
- **RAG limitations:** retrieval can fail or return weak context; fallback responses must not pretend a policy fact was found.
- **Availability:** local Java and a quick tunnel are suitable for a demo, not an always-on production service.

## Outcome

The design makes the user’s email verification real and server-enforced while preserving Node as the identity and registration boundary. The [README hybrid deployment instructions](README.md#hybrid-deployment-hosted-frontend-and-node-local-java) explain why Java must be reachable through the configured tunnel.
