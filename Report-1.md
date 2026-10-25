# Report 1 — Project Requirements and Planning

## SDLC phase

Initiation, requirements gathering, and project planning.

## System overview

MediCare AI Companion is a web application intended to help users explore life-policy information, claims guidance, and policy scenarios without having to read the full technical guide themselves. The application combines a React web client ([frontend source](companion-frontend/src)), a Node.js API ([server](companion-backend-node/server.js)), and a Java service ([backend source](companion-backend/src/main/java/com/candor/companion)) for retrieval-augmented generation (RAG) and policy calculations.

## Problem and goals

The project began with two related user problems: policy information was difficult to locate in a long guide, and users needed a more accessible way to explore policy questions and premium scenarios. Account creation also needed checks that show a user controls the email address they submit and reduce automated signups.

The planned outcomes were:

1. Let users ask policy and claims questions in ordinary language and receive organized, document-grounded answers ([RAG service](companion-backend/src/main/java/com/candor/companion/rag/GroundedChatService.java), [chat renderer](companion-frontend/src/components/MessageList.jsx)).
2. Provide a policy what-if calculator for supported scenarios, with the Java service performing the calculation rather than asking the language model to do arithmetic ([calculation service](companion-backend/src/main/java/com/candor/companion/whatif/WhatIfCalculationService.java)).
3. Support account registration and login through the Node API, with JWT-backed sessions and role checks on protected operations ([auth routes](companion-backend-node/routes/authRoutes.js), [Java authorization](companion-backend/src/main/java/com/candor/companion/security/SecurityConfig.java)).
4. Verify a signup email with a code the user receives and enters on the website, then apply Cloudflare Turnstile before account creation ([signup form](companion-frontend/src/pages/Register.jsx), [Turnstile check](companion-backend-node/middleware/turnstile.js)).
5. Keep provider keys, mail credentials, database credentials, and signing secrets out of browser code and source control.

## Scope and constraints

- **Frontend:** React and Vite signup, login, chat, calculator, and related screens.
- **Node service:** authentication, account persistence, frontend API boundary, Turnstile verification, and proxying selected requests to Java.
- **Java service:** policy retrieval, grounded AI responses, role enforcement, and deterministic what-if calculations.
- **Data:** PostgreSQL for account/application data; SQLite for the local RAG index; Redis for short-lived email-verification state shared by Node and Java.
- **Presentation deployment:** the frontend and Node API may be hosted while Java runs locally and is exposed through a temporary HTTPS tunnel. This depends on the local machine, service, and tunnel staying online.
- **Policy language:** user-facing answers should identify the product as MediCare and avoid exposing the source guide’s original branding.

## Acceptance criteria

- A user cannot proceed from signup until the entered email has been verified.
- The user must receive a real six-digit code and enter it; a client-only “verified” flag is not sufficient.
- Registration must still pass server-side Turnstile validation.
- A signup code expires, has a limited number of attempts, and cannot be reused after verification.
- Java endpoints re-check authentication and authorization for protected policy and calculator requests.
- AI answers should be grounded in retrieved policy material where applicable, and unsupported claims should not be presented as confirmed facts.
- Calculations should be deterministic backend results and should be clearly distinguished from eligibility decisions.

## Planning risks identified

- A RAG answer can be generic when retrieval returns no useful policy chunks or the model provider fails.
- Hosted services may have different network access from local development, particularly for SMTP and local Java endpoints.
- A temporary tunnel URL can change after restart and must be updated in the Node service configuration.
- Policy information must not be confused with a definitive underwriting or eligibility decision.

## Outcome

The project scope was organized around a three-tier architecture and user-visible flows: policy help, calculations, account access, and signup verification. The repository setup is summarized in [README.md](README.md). Later integration work revealed environment-specific delivery and provider-credit issues; those are documented in Reports 2–4.
