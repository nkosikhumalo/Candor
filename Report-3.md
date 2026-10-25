# Report 3 — Implementation and Integration

## SDLC phase

Implementation, integration, and configuration.

## User-facing features

### Signup verification

The registration form provides an email field and a **Send OTP** action. After the send request succeeds, the form displays an **Enter OTP** field and a verification action. The UI only marks the email verified after the server confirms the code. The user then continues to Turnstile and submits the registration form. See [Register.jsx](companion-frontend/src/pages/Register.jsx) and the [auth service requests](companion-frontend/src/services/authService.js).

The email field is normalized before the request. Editing the email clears the previous code and verification state, so a code verified for one address cannot satisfy signup for a different address. This behavior is implemented in [Register.jsx](companion-frontend/src/pages/Register.jsx).

### Policy assistant and calculations

The chat client renders assistant output as Markdown so lists, emphasis, and paragraphs can be presented in a readable structure ([MessageList.jsx](companion-frontend/src/components/MessageList.jsx)). Java retrieves policy-guide chunks and calls a configured AI provider ([GroundedChatService.java](companion-backend/src/main/java/com/candor/companion/rag/GroundedChatService.java)). The application supports a separate what-if endpoint for supported premium/cover scenarios; the calculation is performed by Java service logic ([WhatIfCalculationService.java](companion-backend/src/main/java/com/candor/companion/whatif/WhatIfCalculationService.java)). The chat flow can recognize calculation-oriented requests and route the user toward that feature ([useChat.js](companion-frontend/src/hooks/useChat.js)).

### Account and request security

Node stores users in PostgreSQL and handles password hashing and JWT session cookies ([authController.js](companion-backend-node/controllers/authController.js)). It checks the shared Redis verification marker before account creation ([requireVerifiedEmail.js](companion-backend-node/middleware/requireVerifiedEmail.js)) and calls Cloudflare Siteverify for the Turnstile token ([turnstile.js](companion-backend-node/middleware/turnstile.js)). Java has role-protected policy and calculation endpoints and public routes only for OTP send/verify and health/dev paths as configured ([SecurityConfig.java](companion-backend/src/main/java/com/candor/companion/security/SecurityConfig.java)).

## OTP service implementation

The Java implementation uses Spring Mail over Gmail SMTP and Spring Data Redis ([pom.xml](companion-backend/pom.xml), [application.properties](companion-backend/src/main/resources/application.properties)). OTPs are generated with `SecureRandom`; the stored value is an HMAC-SHA256 digest using `EMAIL_OTP_HASH_SECRET`. The email key is SHA-256 hashed and normalized the same way on both services. Codes expire after five minutes, verification markers after ten minutes, send requests are rate-limited, and incorrect attempts are capped ([EmailOtpService.java](companion-backend/src/main/java/com/candor/companion/email/EmailOtpService.java)).

The Node OTP controller now proxies `/api/auth/email-otp/send` and `/api/auth/email-otp/verify` to Java ([emailOtpController.js](companion-backend-node/controllers/emailOtpController.js), [authRoutes.js](companion-backend-node/routes/authRoutes.js)). The Node registration route still requires email verification and Turnstile before invoking account creation. Node also clears the verification marker after successful registration ([authController.js](companion-backend-node/controllers/authController.js)).

## Integration issue fixed during implementation

An issue appeared after the OTP flow was connected to the hosted Node service: Redis logs showed the send-cooldown and OTP records being written, but email delivery failed at the SMTP stage. The previous flow relied on Node sending Gmail SMTP from the hosted environment. The implementation was changed so Java on the developer machine sends the email and verifies the code, while both services use the same Redis database. Node’s registration middleware remains the enforcement point for the verified marker.

Another provider issue observed during AI requests was an OpenRouter HTTP 402: the request allowed up to 16,384 output tokens while the available credit could afford only 6,719. The Java configuration now defaults `OPENROUTER_MAX_TOKENS` to 1,024, reducing the requested output budget. Provider credits and prompt size can still affect availability; this configuration does not add credits or guarantee provider access.

## Configuration

The Java service reads local `.env` settings ([example](companion-backend/.env.example), [property loading](companion-backend/src/main/resources/application.properties)) for:

- `GMAIL_USER`
- `GMAIL_PASS` (whitespace in the App Password is stripped by the sender)
- `EMAIL_OTP_HASH_SECRET` (at least 32 characters)
- `REDIS_URL` (the same Redis database URL used by Node)

The deployed Node service needs its Redis URL and `JAVA_SERVICE_URL` set to the currently active HTTPS tunnel URL ([Node environment example](companion-backend-node/.env.example), [proxy target resolution](companion-backend-node/services/proxyService.js)). The frontend continues to call Node; it does not receive mail, Redis, or AI-provider secrets.

For a presentation with no email delivery, there is an optional simulated verification mode controlled by `VITE_DEMO_EMAIL_VERIFICATION` in the frontend and `DEMO_EMAIL_VERIFICATION_BYPASS` in the Node server. It is off by default, visibly says that no email was sent, and leaves Turnstile enabled. This mode does not verify ownership of an email address; both flags should be removed or set false after the demo. See the [signup form](companion-frontend/src/pages/Register.jsx), [Node verification middleware](companion-backend-node/middleware/requireVerifiedEmail.js), and [README instructions](README.md#presentation-only-signup-verification-simulation).

## Security and privacy safeguards

- Secrets are represented by placeholders in example configuration and should not be committed with real values.
- OTP codes are short-lived, hashed in storage, rate-limited, and single-use.
- A successful verification marker is scoped to the normalized email and enforced server-side.
- Turnstile validation is performed by Node before account creation.
- AI-provider credentials remain in Java server configuration.
- User-facing policy responses use MediCare branding even though the imported technical guide has a different internal source name.

## Outcome

The repository contains the integrated browser → Node → Java → Redis/mail flow and the corresponding configuration points. The implementation preserves a real email-code interaction; it does not replace verification with a demo-only UI flag.
