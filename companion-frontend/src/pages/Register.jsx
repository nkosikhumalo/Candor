import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCountryCallingCode, getCountries, parsePhoneNumberFromString } from "libphonenumber-js";
import { register as registerUser, sendRegistrationOtp, verifyRegistrationOtp } from "../services/authService";
import TurnstileWidget from "../components/TurnstileWidget";
import "../styles/register.css";

const STEP_FORM = "form";
const STEP_CAPTCHA = "captcha";
const STEP_DONE = "done";
const DEMO_EMAIL_VERIFICATION = import.meta.env.VITE_DEMO_EMAIL_VERIFICATION === "true";
const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const PHONE_COUNTRIES = getCountries()
  .map((country) => ({ country, name: COUNTRY_NAMES.of(country) || country, callingCode: getCountryCallingCode(country) }))
  .sort((a, b) => a.name.localeCompare(b.name));
const COMMON_PASSWORD_PARTS = ["password", "qwerty", "letmein", "welcome", "admin", "medicare", "candor", "iloveyou", "123456"];
const PASSWORD_CHECKS = [
  { id: "length", label: "At least 12 characters", test: (value) => value.length >= 12 },
  { id: "lower", label: "A lowercase letter", test: (value) => /\p{Ll}/u.test(value) },
  { id: "upper", label: "An uppercase letter", test: (value) => /\p{Lu}/u.test(value) },
  { id: "number", label: "A number", test: (value) => /\p{N}/u.test(value) },
  { id: "symbol", label: "A symbol, such as ! or #", test: (value) => /[^\p{L}\p{N}\s]/u.test(value) },
  { id: "common", label: "Avoid common words like password or MediCare", test: (value) => {
    const normalized = value.toLowerCase().replace(/[\W_]+/g, "");
    return !COMMON_PASSWORD_PARTS.some((part) => normalized.includes(part));
  } },
  { id: "bytes", label: "No more than 72 UTF-8 bytes", test: (value) => new TextEncoder().encode(value).length <= 72 },
];

function passwordMeetsPolicy(value) {
  return PASSWORD_CHECKS.every((check) => check.test(value));
}

function countryFlag(country) {
  return [...country].map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join("");
}

function parseRegistrationPhone(value, country) {
  const parsed = parsePhoneNumberFromString(value, country);
  return parsed?.isValid() ? parsed : null;
}

function usernamePreview(firstName, lastName) {
  const part = value => value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return [part(firstName), part(lastName)].filter(Boolean).join(".");
}

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP_FORM);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdUsername, setCreatedUsername] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    phone: "",
    phone_country: "ZA",
    email: "",
    password: "",
    confirm_password: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "email") {
      setEmailCode("");
      setEmailOtpSent(false);
      setEmailVerified(false);
      setEmailMessage("");
      setEmailError("");
    }
  }

  async function handleSendEmailOtp() {
    const email = formData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address first.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    setEmailMessage("");
    try {
      const result = await sendRegistrationOtp(email);
      setEmailOtpSent(true);
      setEmailCode("");
      setEmailMessage(result.message || "We sent a verification code to your email.");
    } catch (err) {
      setEmailError(err.message || "We couldn't send a code. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  function handleDemoEmailVerification() {
    const email = formData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address first.");
      return;
    }
    setEmailError("");
    setEmailVerified(true);
    setEmailMessage("Demo verification complete. No email was sent.");
  }

  async function handleVerifyEmailOtp() {
    if (!/^\d{6}$/.test(emailCode)) {
      setEmailError("Enter the 6-digit code from your email.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    setEmailMessage("");
    try {
      const result = await verifyRegistrationOtp(formData.email.trim().toLowerCase(), emailCode);
      setEmailVerified(true);
      setEmailMessage(result.message || "Email verified.");
    } catch (err) {
      setEmailError(err.message || "That code could not be verified. Check it and try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  function validate() {
    const errs = {};
    if (!formData.first_name.trim()) errs.first_name = "Required";
    if (!formData.last_name.trim()) errs.last_name = "Required";
    if (!formData.date_of_birth) errs.date_of_birth = "Required";
    const parsedPhone = parseRegistrationPhone(formData.phone.trim(), formData.phone_country);
    if (!formData.phone.trim()) errs.phone = "Enter your phone number.";
    else if (!parsedPhone) errs.phone = "Enter a valid phone number for the selected country.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Valid email required";
    }
    if (!passwordMeetsPolicy(formData.password)) errs.password = "Password is too weak. Choose a stronger password.";
    if (formData.password !== formData.confirm_password)
      errs.confirm_password = "Passwords do not match";
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setStep(STEP_CAPTCHA);
  }

  async function handleCaptchaVerify() {
    if (!turnstileToken) {
      setServerError("Please complete the security check.");
      return;
    }
    setSubmitting(true);
    setServerError("");
    try {
      const result = await registerUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        date_of_birth: formData.date_of_birth,
        phone: parseRegistrationPhone(formData.phone.trim(), formData.phone_country).number,
        turnstileToken,
      });
      setCreatedUsername(result.user?.username || "");
      setStep(STEP_DONE);
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
      if (err.message?.toLowerCase().includes("verify your email")) {
        setEmailVerified(false);
        setEmailError(err.message);
      }
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
      setStep(STEP_FORM);
    } finally {
      setSubmitting(false);
    }
  }

  // ── CAPTCHA overlay ──────────────────────────────────────────────────────────
  if (step === STEP_CAPTCHA) {
    return (
      <div className="register-page">
        <div className="reg-overlay-wrap">
          <div className="captcha-card">
            <div className="captcha-spinner-wrap">
              <div className="captcha-spinner" />
            </div>
            <p className="captcha-label">Complete the security check to create your account.</p>
            <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} />
            <button
              className="btn btn-primary"
              onClick={handleCaptchaVerify}
              disabled={!turnstileToken || submitting}
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              className="cancel-link"
              style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setStep(STEP_FORM)}
            >
              ← Back to form
            </button>
            {serverError && <p className="field-error" style={{ marginTop: 12 }}>{serverError}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === STEP_DONE) {
    return (
      <div className="register-page">
        <div className="wrap">
          <div className="card success-screen">
            <div className="check">✓</div>
            <h2>Account created</h2>
            <p>Your account is ready. Your username is <strong>@{createdUsername}</strong>. Use your username or email and password to sign in.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/login", {
                replace: true,
                state: { username: createdUsername, email: formData.email },
              })}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <div className="register-page">
      <div className="topbar">
        <button type="button" onClick={() => window.history.back()}>← Back</button>
      </div>

      <div className="wrap">
        <div className="reg-brand">
          <span className="brand-medi">Medi</span><span className="brand-care">Care</span><span className="brand-dot-navy">.</span>
        </div>

        <h1>Create account</h1>
        <p className="subtitle">Create an account with your contact details. No ID or passport number is needed.</p>

        {serverError && <p className="field-error global-error">{serverError}</p>}

        <div className="card">
          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className="field">
              <input name="first_name" value={formData.first_name} onChange={handleChange} placeholder=" " />
              <label>First name</label>
              {fieldErrors.first_name && <span className="field-error">{fieldErrors.first_name}</span>}
            </div>

            <div className="field">
              <input name="last_name" value={formData.last_name} onChange={handleChange} placeholder=" " />
              <label>Surname</label>
              {fieldErrors.last_name && <span className="field-error">{fieldErrors.last_name}</span>}
            </div>

            <div className="field">
              <input
                value={usernamePreview(formData.first_name, formData.last_name)}
                placeholder=" "
                readOnly
                aria-label="Generated username"
              />
              <label>Generated username</label>
              <span className="field-hint">Created from your name. We’ll add a number if it’s already in use.</span>
            </div>

            {/* Date of birth */}
            <div className="field">
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                placeholder=" "
              />
              <label>Date of birth</label>
              {fieldErrors.date_of_birth && <span className="field-error">{fieldErrors.date_of_birth}</span>}
            </div>

            {/* Phone: country-aware validation; send normalized E.164 to the API. */}
            <div className="field phone-field">
              <label className="phone-country-label" htmlFor="phone-country">Country</label>
              <div className="phone-input-row">
                <select
                  id="phone-country"
                  className="phone-country-select"
                  value={formData.phone_country}
                  onChange={(event) => {
                    setFormData((prev) => ({ ...prev, phone_country: event.target.value }));
                    setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  aria-label="Phone country code"
                >
                  {PHONE_COUNTRIES.map(({ country, name, callingCode }) => (
                    <option key={country} value={country}>{countryFlag(country)} {name} (+{callingCode})</option>
                  ))}
                </select>
                <input
                  id="phone-number"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder=" "
                  inputMode="tel"
                  autoComplete="tel-national"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "phone-error" : "phone-hint"}
                />
                <label htmlFor="phone-number">Phone number</label>
              </div>
              <span className="field-hint" id="phone-hint">Choose your country and enter your number. We’ll save it with the country code.</span>
              {fieldErrors.phone && <span className="field-error" id="phone-error" role="alert">{fieldErrors.phone}</span>}
            </div>

            {/* Email */}
            <div className="email-verification-block">
              <div className="email-input-row">
                <div className="field email-input-field">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder=" " autoComplete="email" />
                  <label>Email address</label>
                </div>
                {!emailVerified && (
                  <button
                    className="email-otp-button"
                    type="button"
                    onClick={DEMO_EMAIL_VERIFICATION ? handleDemoEmailVerification : handleSendEmailOtp}
                    disabled={emailBusy}
                  >
                    {DEMO_EMAIL_VERIFICATION ? "Verify email (demo)" : emailBusy ? "Please wait…" : emailOtpSent ? "Resend OTP" : "Send OTP"}
                  </button>
                )}
                {emailVerified && (
                  <span className="email-verified-badge" role="status">
                    {DEMO_EMAIL_VERIFICATION ? "✓ Demo verified" : "✓ Verified"}
                  </span>
                )}
              </div>
              {emailOtpSent && !emailVerified && !DEMO_EMAIL_VERIFICATION && (
                <div className="email-input-row email-code-row">
                  <div className="field email-code-field">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "")); setEmailError(""); }}
                      placeholder=" "
                      aria-label="Enter OTP"
                    />
                    <label>Enter OTP</label>
                  </div>
                  <button className="email-otp-button" type="button" onClick={handleVerifyEmailOtp} disabled={emailBusy || emailCode.length !== 6}>
                    {emailBusy ? "Checking…" : "Verify OTP"}
                  </button>
                </div>
              )}
              {emailMessage && <p className={emailVerified && !DEMO_EMAIL_VERIFICATION ? "email-verified-message" : "email-status-message"} role="status">{emailVerified && !DEMO_EMAIL_VERIFICATION ? "✓ " : ""}{emailMessage}</p>}
              {emailError && <span className="field-error" role="alert">{emailError}</span>}
              {!emailVerified && (
                <span className="email-status-message">
                  {DEMO_EMAIL_VERIFICATION ? "Presentation demo: this does not send or verify an email. Email verification is optional." : "Email verification is optional for now. You can continue without entering a code."}
                </span>
              )}
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            {/* Password */}
            <div className="field">
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder=" " autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} />
              <label>Password</label>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <div className="field">
              <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} placeholder=" " autoComplete="new-password" />
              <label>Confirm password</label>
              {fieldErrors.confirm_password && <span className="field-error">{fieldErrors.confirm_password}</span>}
            </div>

            <button className="btn btn-primary" type="submit">Continue</button>
          </form>

          <button type="button" className="cancel-link" onClick={() => navigate(-1)}>Cancel</button>
        </div>

        <div className="legal">
          An authorised financial services and registered credit provider.
          <br />©2026 MediCare Limited.<br />
          <a href="#">Legal and Compliance</a>{" | "}
          <a href="#">Terms and Conditions</a>
        </div>
      </div>
    </div>
  );
}
