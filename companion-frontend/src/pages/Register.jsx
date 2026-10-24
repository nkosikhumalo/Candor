import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser, sendRegistrationOtp, verifyRegistrationOtp } from "../services/authService";
import TurnstileWidget from "../components/TurnstileWidget";
import "../styles/register.css";

const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon",
  "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo (Brazzaville)", "Congo (Kinshasa)", "Costa Rica", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
  "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
  "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa",
  "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
].sort();

const STEP_FORM = "form";
const STEP_CAPTCHA = "captcha";
const STEP_DONE = "done";

export default function Register() {
  const navigate = useNavigate();
  const [citizen, setCitizen] = useState("SA");
  const [step, setStep] = useState(STEP_FORM);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [emailCode, setEmailCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    id_number: "",
    passport_number: "",
    country_of_issue: "",
    date_of_birth: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirm_password: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "email") {
      setEmailOtpSent(false);
      setEmailVerified(false);
      setEmailCode("");
      setEmailMessage("");
      setEmailError("");
    }
  }

  function validate() {
    const errs = {};
    if (!formData.first_name.trim()) errs.first_name = "Required";
    if (!formData.last_name.trim()) errs.last_name = "Required";
    if (citizen === "SA") {
      if (!/^\d{13}$/.test(formData.id_number))
        errs.id_number = "SA ID must be exactly 13 digits";
    } else {
      if (!formData.passport_number.trim()) errs.passport_number = "Required";
      if (!formData.country_of_issue) errs.country_of_issue = "Select a country";
    }
    if (!formData.date_of_birth) errs.date_of_birth = "Required";
    if (!formData.phone.trim()) errs.phone = "Required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = "Valid email required";
    if (!formData.username.trim()) errs.username = "Required";
    if (formData.password.length < 8) errs.password = "At least 8 characters";
    if (formData.password !== formData.confirm_password)
      errs.confirm_password = "Passwords do not match";
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (!emailVerified) errs.email = "Verify your email address before continuing";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setStep(STEP_CAPTCHA);
  }

  async function handleSendEmailOtp() {
    const email = formData.email.trim();
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
      setEmailVerified(false);
      setEmailMessage(result.message || "If this address can be verified, a one-time code has been sent.");
    } catch (err) {
      setEmailError(err.message || "We couldn't send a code. Please try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleVerifyEmailOtp() {
    if (!/^\d{6}$/.test(emailCode)) {
      setEmailError("Enter the 6-digit code sent to your email.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    setEmailMessage("");
    try {
      const result = await verifyRegistrationOtp(formData.email.trim(), emailCode);
      setEmailVerified(true);
      setEmailMessage(result.message || "Email verified. You can continue.");
    } catch (err) {
      setEmailError(err.message || "That code could not be verified. Check it and try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleCaptchaVerify() {
    if (!turnstileToken) {
      setServerError("Please complete the security check.");
      return;
    }
    setSubmitting(true);
    setServerError("");
    try {
      await registerUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        ...(citizen === "SA"
          ? { id_number: formData.id_number }
          : { passport_number: formData.passport_number, country_of_issue: formData.country_of_issue }),
        date_of_birth: formData.date_of_birth,
        phone: formData.phone,
        turnstileToken,
      });
      setStep(STEP_DONE);
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
      if (err.message?.includes("Verify your email")) {
        setEmailVerified(false);
        setEmailOtpSent(false);
        setEmailMessage("Your email verification expired. Please request and verify a new code.");
      }
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
            <p className="captcha-label">Verifying your information…</p>
            <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} />
            <button
              className="btn btn-primary"
              onClick={handleCaptchaVerify}
              disabled={!turnstileToken || submitting}
            >
              {submitting ? "Processing…" : "Verify & Continue"}
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
            <p>Your email is verified and your account is ready. You can now log in.</p>
            <button className="btn btn-primary" onClick={() => navigate("/login")}>
              Continue to log in
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
        <p className="subtitle">We will verify your details before activating your account.</p>

        {serverError && <p className="field-error global-error">{serverError}</p>}

        <div className="card">
          <div className="tabs">
            <div className={`tab ${citizen === "SA" ? "active" : ""}`} onClick={() => setCitizen("SA")}>
              SA Citizen
            </div>
            <div className={`tab ${citizen === "NON-SA" ? "active" : ""}`} onClick={() => setCitizen("NON-SA")}>
              Non-SA Citizen
            </div>
          </div>

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

            {/* ID / Passport */}
            {citizen === "SA" ? (
              <div className="field">
                <input
                  name="id_number"
                  value={formData.id_number}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 13);
                    setFormData((p) => ({ ...p, id_number: v }));
                    setFieldErrors((p) => ({ ...p, id_number: "" }));
                  }}
                  inputMode="numeric"
                  maxLength={13}
                  placeholder=" "
                />
                <label>SA ID number (13 digits)</label>
                {fieldErrors.id_number && <span className="field-error">{fieldErrors.id_number}</span>}
              </div>
            ) : (
              <>
                <div className="field">
                  <input name="passport_number" value={formData.passport_number} onChange={handleChange} placeholder=" " />
                  <label>Passport number</label>
                  {fieldErrors.passport_number && <span className="field-error">{fieldErrors.passport_number}</span>}
                </div>

                <div className="field select-field">
                  <label>Country of issue</label>
                  <select
                    name="country_of_issue"
                    value={formData.country_of_issue}
                    onChange={handleChange}
                  >
                    <option value="">Select country</option>
                    {ALL_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {fieldErrors.country_of_issue && <span className="field-error">{fieldErrors.country_of_issue}</span>}
                </div>
              </>
            )}

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

            {/* Phone — plain field for SA, no country-code dropdown */}
            <div className="field">
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder=" "
                inputMode="tel"
              />
              <label>{citizen === "SA" ? "Cell phone number" : "Phone number"}</label>
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </div>

            {/* Email */}
            <div className="email-verification-block">
              <div className="email-input-row">
                <div className="field email-input-field">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder=" " autoComplete="email" />
                  <label>Email address</label>
                </div>
                <button className="btn btn-secondary" type="button" onClick={handleSendEmailOtp} disabled={emailBusy || emailVerified}>
                  {emailBusy && !emailVerified ? "Please wait…" : emailOtpSent ? "Resend OTP" : "Send OTP"}
                </button>
              </div>
              {emailOtpSent && !emailVerified && (
                <div className="email-otp-row">
                  <div className="field email-code-field">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "")); setEmailError(""); }}
                      placeholder=" "
                      autoComplete="one-time-code"
                      aria-label="Email verification code"
                    />
                    <label>6-digit email code</label>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={handleVerifyEmailOtp} disabled={emailBusy || emailCode.length !== 6}>
                    {emailBusy ? "Checking…" : "Verify code"}
                  </button>
                </div>
              )}
              {emailVerified && <p className="email-verified-message" role="status">✓ Email verified</p>}
              {emailMessage && !emailVerified && <p className="email-status-message" role="status">{emailMessage}</p>}
              {emailError && <span className="field-error" role="alert">{emailError}</span>}
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            {/* Username */}
            <div className="field">
              <input name="username" value={formData.username} onChange={handleChange} placeholder=" " />
              <label>Username</label>
              {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
            </div>

            {/* Password */}
            <div className="field">
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder=" " />
              <label>Password</label>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <div className="field">
              <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} placeholder=" " />
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
