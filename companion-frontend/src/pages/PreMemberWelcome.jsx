import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/home.css";

const BENEFIT_HIGHLIGHTS = [
  {
    title: "Family protection",
    detail: "Death, Last Survivor Death, Unnatural Death, Modified Death, Funeral, Education Protector, Death Income, and Estate Provider benefits.",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&h=460&fit=crop&auto=format&q=75",
  },
  {
    title: "Disability and income",
    detail: "Disability, Functional Impairment, Income Protector, Business Protector, Business Overheads, and Group Income Top-up options.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=460&fit=crop&auto=format&q=75",
  },
  {
    title: "Illness and additional cover",
    detail: "Critical Illness, Comprehensive Living Benefit, Accidental HIV, Premium Waiver, Future Cover, Homeloan, and Longevity options.",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=460&fit=crop&auto=format&q=75",
  },
];

export default function PreMemberWelcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, authReady, clearAuth } = useAuth();

  useEffect(() => {
    if (authReady && !token) navigate("/login", { replace: true, state: { from: "/welcome" } });
    else if (authReady && token && (user?.policyId || user?.role === "ROLE_BENEFICIARY")) {
      navigate("/home", { replace: true });
    }
  }, [authReady, token, user, navigate]);

  function openAssistant() {
    navigate("/chat", {
      state: {
        starterQuestion: "I am exploring MediCare life insurance and do not have a policy yet. Help me understand which benefit options may suit my needs, and ask me questions one at a time.",
        backgroundLocation: location,
      },
    });
  }

  if (!authReady || !token || user?.policyId || user?.role === "ROLE_BENEFICIARY") return null;

  return (
    <div className="hp hp-premember">
      <header className="hp-nav">
        <div className="hp-nav-inner">
          <button type="button" className="hp-brand-btn" onClick={() => navigate("/welcome")}>Medi<span>Care</span><span className="hp-brand-dot">.</span></button>
          <div className="hp-nav-right">
            <span className="hp-username-tag">@{user?.username || "member"}</span>
            <button type="button" className="hp-back-btn" onClick={() => { clearAuth(); navigate("/", { replace: true }); }}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="hp-main">
        <div className="hp-wrap">
          <section className="hp-premember-hero">
            <div>
              <span className="hp-premember-eyebrow">YOUR MEDICARE START</span>
              <h1>Welcome, @{user?.username || "member"}</h1>
              <p>Your account is ready. You don’t have an active MediCare policy yet. Explore the life-policy benefits, ask the AI for guidance, or start a membership application.</p>
              <div className="hp-premember-actions">
                <button type="button" className="hp-btn-primary" onClick={() => navigate("/home?view=membership")}>Become a member</button>
                <button type="button" className="hp-btn-outline" onClick={openAssistant}>Ask which policies are suitable for you</button>
              </div>
              <small>Benefit availability, eligibility, premiums, and required documents depend on underwriting and policy terms. Creating an account does not activate cover.</small>
            </div>
            <img src="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1100&h=800&fit=crop&auto=format&q=80" alt="Family spending time together" />
          </section>

          <section className="hp-section hp-premember-benefits">
            <div className="hp-section-head">
              <div className="hp-section-bar" />
              <h2>Explore benefit areas</h2>
              <button type="button" className="hp-link-btn" onClick={() => navigate("/home?view=add-policy")}>See all benefits</button>
            </div>
            <div className="hp-catalogue-grid">
              {BENEFIT_HIGHLIGHTS.map((benefit) => (
                <article className="hp-cat-card" key={benefit.title}>
                  <div className="hp-cat-img"><img src={benefit.image} alt="" /></div>
                  <div className="hp-cat-body"><h3>{benefit.title}</h3><p className="hp-cat-desc">{benefit.detail}</p></div>
                </article>
              ))}
            </div>
            <p className="hp-demo-label">Information is based on the MediCare technical guide and is illustrative. These benefits are not active cover or a personalised quote.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
