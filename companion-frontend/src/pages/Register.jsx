import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser } from "../services/authService";
import TurnstileWidget from "../components/TurnstileWidget";
import "../styles/register.css";

const STEP_FORM = "form";
const STEP_CAPTCHA = "captcha";
const STEP_DONE = "done";

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP_FORM);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
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
  }

  function validate() {
    const errs = {};
    if (!formData.first_name.trim()) errs.first_name = "Required";
    if (!formData.last_name.trim()) errs.last_name = "Required";
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
      await registerUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        date_of_birth: formData.date_of_birth,
        phone: formData.phone,
        turnstileToken,
      });
      setStep(STEP_DONE);
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
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
            <p>Your account is ready. You can now log in with your new credentials.</p>
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
              <label>Phone number</label>
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </div>

            {/* Email */}
            <div className="field">
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder=" " autoComplete="email" />
              <label>Email address</label>
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
