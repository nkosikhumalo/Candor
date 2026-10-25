# Report 4 — Verification, Deployment, and Maintenance

## SDLC phase

Verification, deployment planning, operations, and maintenance.

## Verification performed

The following checks were run against the code in this workspace:

| Check | Result |
| --- | --- |
| Java Maven compile (`-DskipTests compile`) | Passed |
| Node OTP controller and Redis service syntax checks | Passed |
| Node verification middleware syntax check | Passed |
| Frontend ESLint | Passed |
| `git diff --check` | Passed |

These checks establish that the relevant code parses, the Java project compiles, and the frontend lint rules pass. They do not prove that Gmail delivered a live email or that the deployed Render service can reach the current local tunnel.

The checks covered the Java Maven project ([pom.xml](companion-backend/pom.xml)), Node signup and OTP code ([OTP controller](companion-backend-node/controllers/emailOtpController.js), [Redis service](companion-backend-node/services/emailOtpService.js), [verification middleware](companion-backend-node/middleware/requireVerifiedEmail.js)), and the frontend ([package scripts](companion-frontend/package.json)).

## End-to-end acceptance procedure

1. Copy the Java [example environment file](companion-backend/.env.example) to `companion-backend/.env` and enter the Gmail account, Gmail App Password, a random `EMAIL_OTP_HASH_SECRET`, and the same `REDIS_URL` used by Node.
2. Confirm the deployed Node service has that Redis URL and an active `JAVA_SERVICE_URL` pointing to the current HTTPS tunnel ([configuration example](companion-backend-node/.env.example)).
3. Start Java on the port targeted by the tunnel (the repository default is `8080`, configured in [application.properties](companion-backend/src/main/resources/application.properties)). Start the tunnel to that same port and keep both processes running.
4. Open the deployed signup form, enter an email address that is not already registered, and choose **Send OTP**.
5. Confirm the email arrives, enter the six-digit code on the site, and choose **Verify OTP**.
6. Confirm the page displays verified status and permits continuation to Turnstile.
7. Complete Turnstile and submit the account form. Confirm Node creates the user and clears the Redis verification marker.
8. Try an incorrect/expired code and try registration without completing verification; both must be rejected by the [Java OTP verifier](companion-backend/src/main/java/com/candor/companion/email/EmailOtpService.java) and [Node verification middleware](companion-backend-node/middleware/requireVerifiedEmail.js).

For a presentation-only simulation, enable both `VITE_DEMO_EMAIL_VERIFICATION=true` in Vercel and `DEMO_EMAIL_VERIFICATION_BYPASS=true` in Render, then rebuild/redeploy the frontend and restart/redeploy Node. The page labels the action as demo verification and says no email was sent. Turnstile remains active. Disable both flags and redeploy as soon as the presentation is over; the simulation does not establish email ownership.

## Deployment notes

- A Cloudflare quick-tunnel hostname changes when the tunnel is recreated. Update Render’s `JAVA_SERVICE_URL` and restart/redeploy the Node service when it changes.
- Keep the local Java process and tunnel running for the duration of the presentation. A sleeping computer, stopped process, or lost network connection breaks OTP delivery and Java-backed features.
- Use the Java port configured by the application. With the checked-in default, the tunnel target is `http://127.0.0.1:8080`; if Java is configured to use another port, the tunnel must target that port instead.
- Set secrets in local environment files or hosting secret settings. Never paste Gmail App Passwords, Redis credentials, Turnstile secrets, JWT secrets, or model-provider keys into frontend environment variables or source files.
- The Java OTP endpoint uses Redis too; configuring Redis only in Node is not enough. Both services must connect to the same database.

## Known limitations and follow-up

- **Live mail not confirmed here:** compile and lint passed, but actual delivery requires the user’s Gmail credentials and an active tunnel; those were not available to this verification run.
- **Hybrid availability:** local Java and a quick tunnel are a presentation setup, not a durable production deployment. A stable named tunnel or hosted Java service would improve availability.
- **Rate limits:** current OTP limits are keyed by email. Add broader IP/device-level abuse controls before production use.
- **Policy and eligibility:** the assistant can explain guide content and supported calculator outputs, but it should not claim a user qualifies for a policy unless an authoritative eligibility service provides that determination.
- **AI provider availability:** reduced token limits address the observed oversized request but do not resolve insufficient provider balance or outages.
- **Automated flow coverage:** add integration tests for OTP expiry, invalid attempts, marker consumption, Turnstile rejection, and successful registration when a test environment is available.

The release setup is documented in the repository [README](README.md#hybrid-deployment-hosted-frontend-and-node-local-java), with Node enforcement in [authRoutes.js](companion-backend-node/routes/authRoutes.js) and Java authorization in [SecurityConfig.java](companion-backend/src/main/java/com/candor/companion/security/SecurityConfig.java).

## Release status

The implementation is ready for configuration and a manual end-to-end demonstration. The live acceptance procedure above remains necessary before describing email delivery as verified in the deployed environment. No changes in these reports commit or deploy the application.
