import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const CARDS = [
    {
        id: "whatif",
        title: "Explore my cover & costs",
        subtitle: "Simulate premium changes",
        info: "See how upgrading or adjusting your cover affects your monthly premium. Candor will guide you through 3 quick questions then run the calculation instantly — no guessing, no forms.",
        firstMessage: "I'd like to explore how changing my cover amount would affect my monthly premium.",
        intent: "WHAT_IF",
        roles: ["ROLE_POLICYHOLDER"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        ),
    },
    {
        id: "policy",
        title: "Understand my policy",
        subtitle: "Benefits, exclusions & terms",
        info: "Ask Candor to explain what your policy covers, what's excluded, how your benefits work, and what the fine print means — in plain language, not legal jargon.",
        firstMessage: "Can you explain what my policy covers, what's excluded, and how my benefits work?",
        intent: "POLICY_QA",
        roles: ["ROLE_POLICYHOLDER", "ROLE_BENEFICIARY"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
    {
        id: "claims",
        title: "Submit or track a claim",
        subtitle: "Death claims & documents",
        info: "Get step-by-step guidance on submitting a death claim, find out exactly which documents you need, and track the status of an existing claim.",
        firstMessage: "I need help with a death claim — what documents do I need and how do I submit?",
        intent: "CLAIMS",
        roles: ["ROLE_POLICYHOLDER", "ROLE_BENEFICIARY"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        ),
    },
    {
        id: "address",
        title: "Update my details",
        subtitle: "Address & personal info",
        info: "Update your residential address on your policy. A province change requires a proof of residence document. You can also do this directly in Settings.",
        firstMessage: "I'd like to update my residential address on my policy.",
        intent: "POLICY_UPDATE",
        roles: ["ROLE_POLICYHOLDER"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
        ),
    },
    {
        id: "benefits",
        title: "Explore benefit options",
        subtitle: "Family, funeral, disability & illness",
        info: "Explore the life, family, funeral, disability, income protection, and illness benefits described in the MediCare guide.",
        firstMessage: "Which family, funeral, disability, and illness benefits are described in the MediCare guide?",
        intent: "POLICY_QA",
        roles: ["ROLE_POLICYHOLDER", "ROLE_BENEFICIARY"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
        ),
    },
    {
        id: "free",
        title: "Just ask anything",
        subtitle: "Free conversation",
        info: "Not sure where to start? Just type your question and Candor will help — whether it's about your policy, a claim, your premium, or anything else.",
        firstMessage: null,
        intent: "FREE",
        roles: ["ROLE_POLICYHOLDER", "ROLE_BENEFICIARY"],
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
];

function Welcome({ onQuickStart, onFocusInput }) {
    const { user } = useAuth();
    const role = user?.role || "ROLE_POLICYHOLDER";
    const name = user?.first_name || user?.username || "there";
    const [openInfo, setOpenInfo] = useState(null);

    const visibleCards = CARDS.filter(c => c.roles.includes(role));

    function handleSend(card) {
        if (card.intent === "FREE") { onFocusInput?.(); return; }
        onQuickStart(card);
    }

    return (
        <div className="wc-wrap">
            <div className="wc-greeting">
                <div className="wc-mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <h1>Hi {name}, I'm Candor<span className="wc-dot">.</span></h1>
                <p>Your AI companion for MediCare. What would you like to do today?</p>
            </div>

            <div className="wc-grid">
                {visibleCards.map(card => (
                    <div key={card.id} className={`wc-card ${openInfo === card.id ? "wc-card-open" : ""}`}>
                        <div className="wc-card-top">
                            <div className="wc-icon">{card.icon}</div>
                            <div className="wc-card-text">
                                <span className="wc-card-title">{card.title}</span>
                                <span className="wc-card-sub">{card.subtitle}</span>
                            </div>
                            <div className="wc-card-actions">
                                <button
                                    className={`wc-info-btn ${openInfo === card.id ? "wc-info-active" : ""}`}
                                    aria-label="What does this do?"
                                    onClick={() => setOpenInfo(openInfo === card.id ? null : card.id)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                                        {openInfo === card.id
                                            ? <line x1="5" y1="12" x2="19" y2="12" />
                                            : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
                                        }
                                    </svg>
                                </button>
                                <button
                                    className="wc-send-btn"
                                    aria-label={`Start: ${card.title}`}
                                    onClick={() => handleSend(card)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="13" height="13">
                                        <line x1="12" y1="19" x2="12" y2="5" />
                                        <polyline points="5 12 12 5 19 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {openInfo === card.id && (
                            <p className="wc-info-text">{card.info}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Welcome;
