import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import TurnstileWidget from "../components/TurnstileWidget";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveAuth } = useAuth();

  const [view, setView] = useState("login"); // "login" | "forgot" | "forgot-verify"
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  // forgot password state
  const [forgotId, setForgotId] = useState("");
  const [forgotContact, setForgotContact] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");

  const redirectTo = location.state?.from || "/home";

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!turnstileToken) {
        setError("Please complete the security check.");
        return;
      }
      const { user } = await login(email, password, turnstileToken);
      saveAuth(user);
      navigate(redirectTo, {
        replace: true,
        state: location.state?.backgroundLocation
          ? { backgroundLocation: location.state.backgroundLocation }
          : undefined,
      });
    } catch (err) {
      setError(err.message);
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function handleForgotSubmit(e) {
    e.preventDefault();
    // In production this would call the API
    // For now we simulate: if ID/passport looks valid, proceed
    if (!forgotId.trim()) {
      setForgotMsg("Please enter your ID or passport number.");
      return;
    }
    setForgotMsg("");
    setView("forgot-verify");
  }

  function handleForgotVerify(e) {
    e.preventDefault();
    if (!forgotContact.trim()) {
      setForgotMsg("Please enter your email or phone number.");
      return;
    }
    // Simulate: show confirmation
    setForgotMsg("If the details match our records, you'll receive a reset link shortly.");
  }

  if (view === "forgot") {
    return (
      <div className="login-page">
        <div className="topbar">
          <button className="cancel-btn" type="button" onClick={() => { setView("login"); setForgotMsg(""); setForgotId(""); }}>
            ← Back to login
          </button>
        </div>
        <div className="wrap">
          <h1>Reset password</h1>
          <p className="subtitle">Enter your SA ID number or passport number to get started.</p>

          <div className="login-card">
            <form onSubmit={handleForgotSubmit}>
              <div className="field">
                <input
                  type="text"
                  placeholder=" "
                  value={forgotId}
                  onChange={(e) => setForgotId(e.target.value)}
                  required
                />
                <label>ID number or passport number</label>
              </div>
              {forgotMsg && <p className="error-msg" style={{ color: "var(--red)" }}>{forgotMsg}</p>}
              <button className="btn-primary" type="submit">Continue</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === "forgot-verify") {
    return (
      <div className="login-page">
        <div className="topbar">
          <button className="cancel-btn" type="button" onClick={() => { setView("forgot"); setForgotMsg(""); setForgotContact(""); }}>
            ← Back
          </button>
        </div>
        <div className="wrap">
          <h1>Verify identity</h1>
          <p className="subtitle">Enter your registered email address or phone number.</p>

          <div className="login-card">
            <form onSubmit={handleForgotVerify}>
              <div className="field">
                <input
                  type="text"
                  placeholder=" "
                  value={forgotContact}
                  onChange={(e) => setForgotContact(e.target.value)}
                  required
                />
                <label>Email or phone number</label>
              </div>
              {forgotMsg && (
                <p className="error-msg" style={{ color: forgotMsg.startsWith("If the") ? "#2e9e4b" : "var(--red)", background: forgotMsg.startsWith("If the") ? "#e7f5ea" : undefined }}>
                  {forgotMsg}
                </p>
              )}
              {!forgotMsg && <button className="btn-primary" type="submit">Send reset link</button>}
              {forgotMsg && forgotMsg.startsWith("If the") && (
                <button className="btn-primary" type="button" onClick={() => setView("login")}>Back to login</button>
              )}
              {forgotMsg && !forgotMsg.startsWith("If the") && (
                <p className="error-msg">{forgotMsg} Please <a href="/register">register</a> or contact support.</p>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="topbar">
        <button
          className="cancel-btn"
          type="button"
          onClick={() => navigate("/")}
        >
          Cancel
        </button>
      </div>

      <div className="wrap">
        <h1 className="login-title">
          <span className="brand-medi">Medi</span><span className="brand-care">Care</span><span className="brand-dot-navy">.</span>
        </h1>

        <h2 className="login-heading">Log in</h2>

        <p className="subtitle">
          Your login details work across all MediCare services.
        </p>

        <div className="login-card">
          <form onSubmit={handleLogin}>
            <div className="field">
              <input
                type="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <label>Email</label>
            </div>

            <div className="field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <label>Password</label>

              <button
                type="button"
                className="eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} />
            {error && <p className="error-msg">{error}</p>}

            <button className="btn-primary" type="submit" disabled={loading || !turnstileToken}>
              {loading ? "Signing in…" : "Log in"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/register")}
            >
              Create account
            </button>
          </form>
        </div>

        <div className="divider-copy">
          <button
            type="button"
            className="forgot-link"
            onClick={() => { setView("forgot"); setForgotMsg(""); setForgotId(""); }}
          >
            Forgot password?
          </button>
        </div>
      </div>

      <button className="help-fab" type="button" aria-label="Help">?</button>
    </div>
  );
}

export default Login;
