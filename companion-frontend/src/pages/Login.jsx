import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveAuth } = useAuth();

  const [view, setView] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState(() =>
    location.state?.username || location.state?.email || ""
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = location.state?.from || "/home";

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await login(loginIdentifier, password);
      saveAuth(user);
      navigate(redirectTo, {
        replace: true,
        state: location.state?.backgroundLocation
          ? { backgroundLocation: location.state.backgroundLocation }
          : undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (view === "forgot") {
    return (
      <div className="login-page">
        <div className="topbar">
          <button className="cancel-btn" type="button" onClick={() => setView("login")}>
            ← Back to login
          </button>
        </div>
        <div className="wrap">
          <h1>Password reset</h1>
          <p className="subtitle">Password reset is not enabled for this school project. Please contact the project administrator for help.</p>

          <div className="login-card">
            <button className="btn-primary" type="button" onClick={() => setView("login")}>Back to login</button>
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
          {location.state?.username && (
            <p className="login-account-hint" role="status">
              Your generated username is <strong>@{location.state.username}</strong>.
            </p>
          )}
          <form onSubmit={handleLogin}>
            <div className="field">
              <input
                type="text"
                placeholder=" "
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
              <label>Email or username</label>
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

            {error && <p className="error-msg">{error}</p>}

            <button className="btn-primary" type="submit" disabled={loading}>
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
            onClick={() => setView("forgot")}
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
