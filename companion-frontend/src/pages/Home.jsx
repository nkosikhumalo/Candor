import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { isPreMemberAccount } from "../services/accountStatus";
import MembershipApplication from "../components/MembershipApplication";
import "../styles/home.css";
import { apiFetch } from "../services/api";

const CLAIM_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CLAIM_TYPES = [
  { value: 'LIFE_COVER', label: 'Life cover claim' },
  { value: 'FUNERAL_COVER', label: 'Funeral cover claim' },
  { value: 'OTHER_DEATH_BENEFIT', label: 'Other death benefit claim' },
];

const PASSPORT_COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Democratic Republic of the Congo', 'Eswatini',
  'Lesotho', 'Malawi', 'Mozambique', 'Namibia', 'Nigeria', 'Rwanda', 'Tanzania',
  'Uganda', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe', 'Australia',
  'Bangladesh', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Japan',
  'Pakistan', 'Portugal', 'Somalia', 'South Korea', 'Spain', 'United Arab Emirates',
];

const CLAIMS = [];

const POLICY_CATALOGUE = [
  { id: "death", type: "Family protection", plan: "Death Benefit", description: "A life-cover benefit intended to provide financial support to nominated beneficiaries after the insured life dies, subject to policy terms and underwriting.", premium: "Quote after application review", benefits: ["Death Benefit", "Last Survivor Death Benefit", "Unnatural Death Benefit", "Modified Death Benefit"], img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "funeral", type: "Family protection", plan: "Funeral Benefit", description: "A benefit option within the life-policy guide. Eligibility, insured lives, limits, and claim requirements depend on the selected benefit terms.", premium: "Quote after application review", benefits: ["Funeral Benefit", "Family-focused cover option", "Benefit terms apply", "Underwriting may apply"], img: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "education", type: "Family protection", plan: "Education Protector", description: "A benefit option listed in the guide to support education-related needs following a qualifying insured event, subject to its terms.", premium: "Quote after application review", benefits: ["Education Protector", "Benefit amount and term rules apply", "Standalone benefit listed in guide", "Subject to policy conditions"], img: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "income", type: "Income protection", plan: "Complete Income Protector", description: "Income-protection benefit with definitions and conditions set out in the technical guide. It is not a guarantee of acceptance or payment.", premium: "Quote after application review", benefits: ["Complete Income Protector", "Temporary Income Protector", "Business Protector", "Business Overheads Protector", "Group Income Top-up Benefit"], img: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "disability", type: "Disability protection", plan: "Comprehensive Disability Benefit", description: "Disability and impairment benefit options are assessed against the definitions, evidence requirements, and limits in the policy terms.", premium: "Quote after application review", benefits: ["Comprehensive Disability Benefit", "Own Occupation Disability Benefit", "Comprehensive ADW Disability Benefit", "ADW Disability Benefit", "Functional Impairment Benefit"], img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "illness", type: "Illness protection", plan: "Complete Critical Illness Benefit", description: "Critical-illness and living-benefit options are defined by specified claim events and policy conditions in the guide.", premium: "Quote after application review", benefits: ["Complete Critical Illness Benefit", "Complete Enhanced Critical Illness Benefit", "Comprehensive Living Benefit", "Accidental HIV Benefit"], img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "estate", type: "Family protection", plan: "Estate Provider Benefit", description: "An estate-related life benefit option described in the guide. The insurer determines the actual terms and any payable amount after assessment.", premium: "Quote after application review", benefits: ["Estate Provider Benefit", "Death Income Benefit", "Benefit limits apply", "Subject to claims assessment"], img: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "homeloan", type: "Loan protection", plan: "Homeloan Protector", description: "A home-loan-related benefit option. Loan details and the policy’s underwriting and benefit conditions affect the cover available.", premium: "Quote after application review", benefits: ["Homeloan Protector", "Future Cover options", "Loan evidence may be requested", "Subject to policy terms"], img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=460&fit=crop&auto=format&q=75" },
  { id: "additional", type: "Additional benefits", plan: "Premium Waiver & Future Cover", description: "The guide describes additional options that may be available with particular benefits or packages, subject to their rules.", premium: "Availability depends on application", benefits: ["Premium Waiver", "Future Cover", "Homeloan Protector", "Longevity Protector", "Professional, Student and Homeloan packages"], img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=460&fit=crop&auto=format&q=75" },
];


const NOTIFICATIONS = [];

const DOCS = [];

const BENEFITS = [
  {
    id: "family",
    title: "Family and life benefits",
    summary: "Explore death, funeral, education, income, and estate-related benefit options.",
    img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=400&fit=crop&auto=format&q=75",
    cta: "Explore benefits",
    details: ["Death Benefit", "Funeral Benefit", "Education Protector", "Death Income and Estate Provider benefits"],
  },
  {
    id: "disability-income",
    title: "Disability and income benefits",
    summary: "The guide lists several disability, impairment, and income-protection benefits.",
    img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop&auto=format&q=75",
    cta: "Explore benefits",
    details: ["Comprehensive and Own Occupation Disability", "Functional Impairment", "Complete and Temporary Income Protector", "Business and Group Income benefits"],
  },
  {
    id: "illness",
    title: "Illness and additional cover",
    summary: "Critical-illness, living-benefit, and additional cover options are subject to their definitions and conditions.",
    img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=400&fit=crop&auto=format&q=75",
    cta: "Explore benefits",
    details: ["Complete and Enhanced Critical Illness", "Comprehensive Living Benefit", "Accidental HIV Benefit", "Premium Waiver and Future Cover options"],
  },
];

// ── UserAvatar — fits perfectly in its circle, theme-aware ──────────────────
function UserAvatar({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="user-avatar-svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Background */}
      <circle cx="20" cy="20" r="20" className="avatar-bg" />
      {/* Head — smaller, sits higher */}
      <circle cx="20" cy="14" r="5.5" className="avatar-figure" />
      {/* Shoulders — starts at y=22, peak at y=30, well inside circle */}
      <path d="M8 32 Q8 22 20 22 Q32 22 32 32" className="avatar-figure" />
    </svg>
  );
}
function HomeNav({ onBack, onGoHome, onViewNotif, darkMode, toggleTheme,
  unreadCount, menuOpen, setMenuOpen, onLogout, username }) {
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen, setMenuOpen]);

  return (
    <header className="hp-nav">
      <div className="hp-nav-inner">
        <button className="hp-brand-btn" onClick={onGoHome}>Medi<span>Care</span><span className="hp-brand-dot">.</span></button>
        <div className="hp-nav-right">
          {username && <span className="hp-username-tag">@{username}</span>}
          {onBack && <button className="hp-back-btn" onClick={onBack}>← Back</button>}
          <button className="hp-theme-btn" onClick={toggleTheme}>{darkMode ? "Light" : "Dark"}</button>
          <button className="hp-notif-btn" onClick={onViewNotif} aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="hp-notif-badge">{unreadCount}</span>}
          </button>
          <div ref={menuRef} style={{ position: "relative" }}>
            <button className="hp-avatar hp-avatar-svg" onClick={() => setMenuOpen(o => !o)} aria-label="Account menu">
              <UserAvatar size={34} />
            </button>
            {menuOpen && (
              <div className="hp-avatar-menu">
                <button onClick={() => { onViewNotif(); setMenuOpen(false); }}>Notifications</button>
                <button className="hp-logout" onClick={onLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();
  const { user, token, authReady, clearAuth } = useAuth();
  const [claims, setClaims] = useState([]);
  const [todayDate] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  });
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState("");
  const [claimFormOpen, setClaimFormOpen] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimNotice, setClaimNotice] = useState("");
  const [claimForm, setClaimForm] = useState({
    claim_type: 'LIFE_COVER',
    claimant_name: "",
    claimant_relationship: "",
    deceased_name: "",
    deceased_document_type: 'ID',
    deceased_id_number: "",
    passport_country: "",
    date_of_death: "",
    notes: "",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [benefitModal, setBenefitModal] = useState(null);

  const params = new URLSearchParams(location.search);
  const view = params.get("view") || "home";

  useEffect(() => {
    if (authReady && !token) navigate("/login", { state: { from: "/home" }, replace: true });
    else if (authReady && token && isPreMemberAccount(user) && !["membership", "add-policy"].includes(view)) {
      navigate("/welcome", { replace: true });
    }
  }, [token, authReady, user, navigate, view]);

  useEffect(() => {
    if (!authReady || !token || !user?.policyId) return undefined;
    let cancelled = false;
    apiFetch("/api/claims")
      .then(data => {
        if (!cancelled) {
          setClaims(Array.isArray(data.claims) ? data.claims : []);
          setClaimsError("");
        }
      })
      .catch(error => {
        if (!cancelled) setClaimsError(error.message || "Could not load your claims.");
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });
    return () => { cancelled = true; };
  }, [authReady, token, user?.policyId]);

  function openClaimForm() {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    setClaimForm(current => ({ ...current, claimant_name: current.claimant_name || name }));
    setClaimError("");
    setClaimNotice("");
    setClaimFormOpen(true);
  }

  async function submitClaim(event) {
    event.preventDefault();
    setClaimSubmitting(true);
    setClaimError("");
    try {
      const data = await apiFetch("/api/claims", {
        method: "POST",
        body: JSON.stringify(claimForm),
      });
      if (data.claim) setClaims(current => [data.claim, ...current.filter(item => item.id !== data.claim.id)]);
      setClaimsError("");
      setClaimNotice(data.message || "Your claim has been submitted.");
      setClaimForm({ claim_type: 'LIFE_COVER', claimant_name: "", claimant_relationship: "", deceased_name: "", deceased_document_type: 'ID', deceased_id_number: "", passport_country: "", date_of_death: "", notes: "" });
      setClaimFormOpen(false);
    } catch (error) {
      setClaimError(error.message || "We could not submit your claim. Please try again.");
    } finally {
      setClaimSubmitting(false);
    }
  }


  function setView(v) {
    if (v === "home") navigate("/home", { replace: false });
    else navigate(`/home?view=${v}`);
  }

  const displayName = user?.username || user?.first_name || "Member";
  const userRole = user?.role?.replace(/^ROLE_/, "") || "Policyholder";
  const unreadCount = NOTIFICATIONS.filter(n => n.unread).length;
  const recentClaims = [
    ...claims.map(claim => {
      const status = (claim.status || "CLAIM_SUBMITTED_PENDING_REVIEW").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
      const dateValue = claim.created_at || claim.date_of_death;
      const dateParts = dateValue ? String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
      const displayedDate = dateParts
        ? `${Number(dateParts[3])} ${CLAIM_MONTH_NAMES[Number(dateParts[2]) - 1]} ${dateParts[1]}`
        : '—';
      return {
        key: `claim-${claim.id}`,
        type: CLAIM_TYPES.find(type => type.value === claim.claim_type)?.label || 'Death benefit claim',
        ref: `CLM-${String(claim.id).padStart(6, "0")}`,
        date: displayedDate,
        amount: "To be assessed",
        status,
        paid: ["PAID", "APPROVED"].includes((claim.status || "").toUpperCase()),
      };
    }),
    ...CLAIMS.map(claim => ({ ...claim, key: `default-${claim.id}`, paid: claim.status === "Paid" })),
  ];

  const navProps = {
    onGoHome: () => setView("home"),
    onViewNotif: () => setView("notifications"),
    darkMode, toggleTheme, unreadCount,
    menuOpen, setMenuOpen,
    username: user?.username,
    onLogout: () => { clearAuth(); navigate("/", { replace: true }); },
  };

  if (view === "membership") {
    return (
      <div className="hp">
        <HomeNav {...navProps} onBack={() => setView("home")} />
        <MembershipApplication user={user} onBack={() => setView("home")} />
      </div>
    );
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (view === "notifications") {
    return (
      <div className="hp">
        <HomeNav {...navProps} onBack={() => setView("home")} />
        <main className="hp-main">
          <div className="hp-wrap">
            <div className="hp-page-title">
              <h1>Notifications</h1>
              {unreadCount > 0 && <span className="hp-count-pill">{unreadCount} new</span>}
            </div>
            <div className="hp-notif-list">
              {NOTIFICATIONS.map(n => (
                <div key={n.id} className={`hp-notif ${n.unread ? "hp-notif-unread" : ""}`}>
                  <div className="hp-notif-dot-side" />
                  <div className="hp-notif-body">
                    <p>{n.text}</p>
                    <span>{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Add / browse policies ─────────────────────────────────────────────────
  if (view === "add-policy") {
    return (
      <div className="hp">
        <HomeNav {...navProps} onBack={() => setView("home")} />
        <main className="hp-main">
          <div className="hp-wrap">
            <div className="hp-page-title">
              <h1>MediCare life-policy benefits</h1>
              <p>Explore options described in the MediCare technical guide. These are illustrative, not a quote or confirmation of cover.</p>
            </div>
            <div className="hp-catalogue-grid">
              {POLICY_CATALOGUE.map(p => (
                <div key={p.id} className="hp-cat-card">
                  <div className="hp-cat-img">
                    <img src={p.img} alt={p.type} />
                    <span className="hp-cat-type-badge">{p.type}</span>
                  </div>
                  <div className="hp-cat-body">
                    <h3>{p.plan}</h3>
                    <p className="hp-cat-desc">{p.description}</p>
                    <ul className="hp-cat-benefits">
                      {p.benefits.map(b => <li key={b}>{b}</li>)}
                    </ul>
                    <div className="hp-cat-price">{p.premium}</div>
                    <div className="hp-cat-footer">
                      <button className="hp-btn-primary" onClick={() =>
                        navigate("/chat", { state: { starterQuestion: `Explain the ${p.plan} benefit and the policy terms that apply to an existing member.`, backgroundLocation: location } })
                      }>Ask Candor about this benefit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Home dashboard ────────────────────────────────────────────────────────
  return (
    <div className="hp">
      <HomeNav {...navProps} />

      <div className="hp-profile-header">
        <div className="hp-wrap hp-profile-inner">
          <div className="hp-profile-left">
            <div className="hp-profile-avatar-wrap">
              <div className="hp-profile-avatar">
                <UserAvatar size={48} />
              </div>
            </div>
            <div className="hp-profile-info">
              <p className="hp-profile-welcome">Welcome, {displayName}<span className="hp-red-dot">.</span></p>
              <div className="hp-profile-meta">
                <span className="hp-role-pill">{userRole}</span>
              </div>
              <div className="hp-profile-details">
                <span className="hp-profile-id">Username: @{user?.username || "member"}</span>
              </div>
            </div>
          </div>
          <div className="hp-profile-stats">
            <div className="hp-stat">
              <span className="hp-stat-num">{user?.policyId || "Linked"}</span>
              <span className="hp-stat-label">Policy number</span>
            </div>
          </div>
        </div>
      </div>

      <main className="hp-main">
        <div className="hp-wrap">

          <div className="hp-actions-row">
            {userRole === "POLICYHOLDER" ? (
              <button className="hp-action-btn hp-primary-action" onClick={() => navigate("/chat", { state: {
                starterQuestion: "I want to run a what-if premium simulation for my MediCare cover. Guide me through my current monthly premium, current cover amount, the cover amount I want to explore, and the waiting period, then calculate the estimate.",
                backgroundLocation: location,
              } })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Run a what-if simulation
              </button>
            ) : (
              <button className="hp-action-btn hp-primary-action" onClick={openClaimForm}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                Submit a claim
              </button>
            )}
            <button className="hp-action-btn hp-primary-action" onClick={() => setView("add-policy")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
              View benefit guide
            </button>
            <button className="hp-action-btn" onClick={() => navigate("/chat", { state: { backgroundLocation: location } })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Ask Candor
            </button>
            <button className="hp-action-btn" onClick={() => setView("notifications")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              Notifications
              {unreadCount > 0 && <span className="hp-action-dot" />}
            </button>
          </div>

          <section className="hp-section">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>My MediCare account</h2>
            </div>
            <div className="hp-membership-card">
              <div className="hp-membership-account-grid">
                <div><small>Policy number</small><strong>{user?.policyId || "Contact support to link your policy"}</strong></div>
                <div><small>Account role</small><strong>{userRole === "BENEFICIARY" ? "Beneficiary" : "Policyholder"}</strong></div>
              </div>
              <p>Your account is linked to a MediCare policy. Use the benefit guide, premium calculator, claims, and Candor support for help with your cover.</p>
            </div>
          </section>

          <section className="hp-section">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>Understand your benefits</h2>
              <button className="hp-link-btn" onClick={() => setView("add-policy")}>View all benefits</button>
            </div>
            <div className="hp-catalogue-grid hp-dashboard-benefits">
              {POLICY_CATALOGUE.slice(0, 6).map(p => (
                <article className="hp-cat-card" key={p.id}>
                  <div className="hp-cat-img"><img src={p.img} alt="" /><span className="hp-cat-type-badge">{p.type}</span></div>
                  <div className="hp-cat-body"><h3>{p.plan}</h3><p className="hp-cat-desc">{p.description}</p>
                    <button className="hp-benefit-link" onClick={() => navigate("/chat", { state: { starterQuestion: `Explain the ${p.plan} benefit and what policy terms determine eligibility.`, backgroundLocation: location } })}>Ask the AI about this</button>
                  </div>
                </article>
              ))}
            </div>
            <p className="hp-demo-label">These are benefit options from the technical guide. They are not active cover, personalised advice, or a quote.</p>
          </section>

          <section className="hp-section">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>Recent claims</h2>
              <button className="hp-link-btn" onClick={openClaimForm}>Submit a claim</button>
            </div>
            {claimNotice && <p className="hp-claim-notice" role="status">{claimNotice}</p>}
            {claimsError && <p className="hp-claim-error" role="alert">{claimsError}</p>}
            <div className="hp-claims-table">
              <div className="hp-claims-head">
                <span>Type</span><span>Reference</span><span>Date submitted</span><span>Benefit amount</span><span>Status</span>
              </div>
              {claimsLoading && <p className="hp-claims-loading" role="status">Checking for your submitted claims…</p>}
              {!claimsLoading && !claimsError && recentClaims.length === 0 && <p className="hp-claims-empty">You have not submitted any claims yet.</p>}
              {recentClaims.map(claim => (
                <div key={claim.key} className="hp-claims-row">
                  <span>{claim.type}</span>
                  <span className="hp-claims-ref">{claim.ref}</span>
                  <span>{claim.date}</span>
                  <span className="hp-claims-amount">{claim.amount}</span>
                  <span className={`hp-claims-status ${claim.paid ? "paid" : "progress"}`}>{claim.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="hp-section">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>Your benefits</h2>
            </div>
            <div className="hp-benefits-grid">
              {BENEFITS.map(b => (
                <div key={b.id} className="hp-benefit-card">
                  <img src={b.img} alt={b.title} />
                  <div className="hp-benefit-body">
                    <h4>{b.title}</h4>
                    <p>{b.summary}</p>
                    <button className="hp-benefit-link" onClick={() => setBenefitModal(b)}>{b.cta}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="hp-section">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>Documents</h2>
            </div>
            <div className="hp-docs-list">
              {DOCS.length === 0 && <p className="hp-claims-empty">No policy documents are linked to this demo account yet. Contact a MediCare adviser if you need a copy of your policy documents.</p>}
              {DOCS.map(d => (
                <div key={d.name} className="hp-doc-row">
                  <div className="hp-doc-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <div className="hp-doc-info">
                    <span>{d.name}</span>
                    <span>{d.date}</span>
                  </div>
                  <button className="hp-doc-download" aria-label="Download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      <button className="hp-fab" onClick={() => navigate("/chat", { state: { backgroundLocation: location } })} aria-label="Ask Candor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Ask Candor</span>
      </button>

      {claimFormOpen && (
        <div className="hp-benefit-modal-backdrop" onClick={() => !claimSubmitting && setClaimFormOpen(false)}>
          <section className="hp-benefit-modal hp-claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-form-title" onClick={event => event.stopPropagation()}>
            <button type="button" className="hp-benefit-modal-close" onClick={() => setClaimFormOpen(false)} aria-label="Close claim form" disabled={claimSubmitting}>×</button>
            <div className="hp-benefit-modal-body">
              <span className="hp-policy-type">Death benefit</span>
              <h3 id="claim-form-title">Submit a claim</h3>
              <p className="hp-benefit-modal-summary">Tell us about the claimant and the insured person. We’ll register your claim for review and show it in Recent claims.</p>
              <form className="hp-claim-form" onSubmit={submitClaim}>
                <label><span className="hp-claim-label-text">Type of claim <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <select name="claim_type" required value={claimForm.claim_type} onChange={event => setClaimForm({ ...claimForm, claim_type: event.target.value })}>
                    {CLAIM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label><span className="hp-claim-label-text">Claimant’s full name <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <input name="claimant_name" autoComplete="name" required maxLength={255} value={claimForm.claimant_name} onChange={event => setClaimForm({ ...claimForm, claimant_name: event.target.value })} />
                </label>
                <label><span className="hp-claim-label-text">Relationship to the insured person <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <select name="claimant_relationship" required value={claimForm.claimant_relationship} onChange={event => setClaimForm({ ...claimForm, claimant_relationship: event.target.value })}>
                    <option value="">Select relationship</option>
                    <option>Spouse or partner</option><option>Child</option><option>Parent</option><option>Sibling</option><option>Other family member</option><option>Other</option>
                  </select>
                </label>
                <label><span className="hp-claim-label-text">Insured person’s full name <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <input name="deceased_name" required maxLength={255} value={claimForm.deceased_name} onChange={event => setClaimForm({ ...claimForm, deceased_name: event.target.value })} />
                </label>
                <label><span className="hp-claim-label-text">Insured person’s identity document <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <select name="deceased_document_type" required value={claimForm.deceased_document_type} onChange={event => setClaimForm({ ...claimForm, deceased_document_type: event.target.value, deceased_id_number: '', passport_country: '' })}>
                    <option value="ID">South African ID</option>
                    <option value="PASSPORT">Passport</option>
                  </select>
                </label>
                {claimForm.deceased_document_type === 'ID' ? (
                  <label><span className="hp-claim-label-text">13-digit South African ID number <span className="hp-claim-required" aria-hidden="true">*</span></span>
                    <input name="deceased_id_number" type="text" inputMode="numeric" required minLength={13} maxLength={13} pattern="[0-9]{13}" title="Enter exactly 13 digits" autoComplete="off" value={claimForm.deceased_id_number} onChange={event => setClaimForm({ ...claimForm, deceased_id_number: event.target.value.replace(/\D/g, '') })} />
                  </label>
                ) : (
                  <>
                    <label><span className="hp-claim-label-text">Passport number <span className="hp-claim-required" aria-hidden="true">*</span></span>
                      <input name="deceased_id_number" type="text" required maxLength={50} autoComplete="off" value={claimForm.deceased_id_number} onChange={event => setClaimForm({ ...claimForm, deceased_id_number: event.target.value })} />
                    </label>
                    <label><span className="hp-claim-label-text">Passport country of origin <span className="hp-claim-required" aria-hidden="true">*</span></span>
                      <select name="passport_country" required value={claimForm.passport_country} onChange={event => setClaimForm({ ...claimForm, passport_country: event.target.value })}>
                        <option value="">Select country</option>
                        {PASSPORT_COUNTRIES.map(country => <option key={country}>{country}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <label><span className="hp-claim-label-text">Date of death <span className="hp-claim-required" aria-hidden="true">*</span></span>
                  <input name="date_of_death" type="date" required max={todayDate} value={claimForm.date_of_death} onChange={event => setClaimForm({ ...claimForm, date_of_death: event.target.value })} />
                </label>
                <label className="hp-claim-notes">Anything else we should know? <span>(optional)</span>
                  <textarea name="notes" rows="3" maxLength={2000} value={claimForm.notes} onChange={event => setClaimForm({ ...claimForm, notes: event.target.value })} />
                </label>
                <div className="hp-claim-docs">
                  <strong>Documents you’ll need for review</strong>
                  <ul>
                    <li>Certified death certificate / DHA-1663 notice of death</li>
                    <li>Certified ID copies for the insured person and claimant</li>
                    <li>Recent bank statement for the claimant</li>
                  </ul>
                  <span>You can submit this form now; our team may request these documents during review.</span>
                </div>
                {claimError && <p className="hp-claim-error" role="alert">{claimError}</p>}
                <div className="hp-claim-form-actions">
                  <button type="button" className="hp-btn-ghost" onClick={() => setClaimFormOpen(false)} disabled={claimSubmitting}>Cancel</button>
                  <button type="submit" className="hp-btn-primary" disabled={claimSubmitting}>{claimSubmitting ? "Submitting…" : "Send claim"}</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {benefitModal && (
        <div className="hp-benefit-modal-backdrop" onClick={() => setBenefitModal(null)}>
          <div className="hp-benefit-modal" onClick={e => e.stopPropagation()}>
            <button className="hp-benefit-modal-close" onClick={() => setBenefitModal(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <img src={benefitModal.img} alt={benefitModal.title} className="hp-benefit-modal-img" />
            <div className="hp-benefit-modal-body">
              <h3>{benefitModal.title}</h3>
              <p className="hp-benefit-modal-summary">{benefitModal.summary}</p>
              <ul className="hp-benefit-modal-list">
                {benefitModal.details.map(d => <li key={d}>{d}</li>)}
              </ul>
              <button className="hp-btn-primary hp-benefit-modal-btn" onClick={() => setBenefitModal(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
