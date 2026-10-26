import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ragChat } from "../services/aiService";
import { apiFetch } from "../services/api";
import { saveMessage, createConversation } from "../services/chatService";

const WI_STEPS = {
    IDLE: "IDLE",
    AWAIT_CURRENT_PREMIUM: "AWAIT_CURRENT_PREMIUM",
    AWAIT_CURRENT_COVER: "AWAIT_CURRENT_COVER",
    AWAIT_REQUESTED_COVER: "AWAIT_REQUESTED_COVER",
    AWAIT_WAITING_PERIOD: "AWAIT_WAITING_PERIOD",
};

function chatFailureMessage(err) {
    if (err?.data?.code === "UPSTREAM_AUTH_ERROR") {
        return "Java rejected the session token. Sign out and back in, then try again.";
    }
    if (err?.status === 502 || err?.message?.includes("Upstream service unavailable")) {
        return "The AI service is not reachable. Check that Node's JAVA_SERVICE_URL points to the current Java service URL.";
    }
    if (err?.status === 403) {
        return "Your account status does not match this chat endpoint. Sign out and back in to refresh your account, then try again.";
    }
    if (err?.status >= 500) {
        return `The AI backend returned an error (HTTP ${err.status}). Check the Java service logs and AI provider configuration.`;
    }
    return "The AI request failed. Please try again in a moment.";
}

// Cover options shown as tappable chips — pulled from real plan data
export const COVER_OPTIONS = [
    { label: "R 250 000", value: 250000, plan: "Essential Smart" },
    { label: "R 500 000", value: 500000, plan: "Essential Plus" },
    { label: "R 750 000", value: 750000, plan: "Premier Smart" },
    { label: "R 1 000 000", value: 1000000, plan: "Premier Plus" },
    { label: "R 1 500 000", value: 1500000, plan: "LifeGuard Plus" },
    { label: "R 2 000 000", value: 2000000, plan: "LifeGuard Elite" },
];

export const WAITING_OPTIONS = [
    { label: "No waiting period", value: 0 },
    { label: "3 months", value: 3 },
    { label: "6 months", value: 6 },
    { label: "12 months", value: 12 },
    { label: "24 months", value: 24 },
];

const CATALOGUE_PITCH = {
    medical: "With private hospital costs rising every year, why is Essential Smart the right medical aid for my family? What would I be risking by not having this cover?",
    life: "If something happened to me tomorrow, would LifeGuard Plus actually protect my family long-term? Why should I choose this over cheaper life cover options?",
    car: "Is DriveSecure Comprehensive worth the premium compared to third-party-only cover? What real-world scenarios would make me glad I had this policy?",
    home: "How much could I lose without HomeShield if my home was damaged by fire or flooding? Why is this level of cover the smart choice for a homeowner?",
    funeral: "Funeral costs can exceed R50 000 overnight — why is FamilyCare Funeral the best way to protect my family from that burden?",
    disability: "If I couldn't work for 6 months, how would I pay my bills? Why is AbilityGuard disability cover essential rather than optional?",
};

function buildPolicyOptions(policy, isCatalogue) {
    const header = policy.type;
    const plan = policy.plan;

    if (isCatalogue) {
        const pitch = CATALOGUE_PITCH[policy.id] ||
            `Why should I choose ${plan} for my ${header} needs? What makes it worth the investment compared to going without cover?`;
        return [
            { id: "ask_plan", label: `Ask about ${header} plan`, message: pitch },
            { id: "what_if", label: "What-if scenarios", intent: "WHAT_IF" },
            { id: "maths", label: "Run the maths", message: `What would my monthly premium be for ${plan} (${header})? Break down the cost at different cover levels and show me the value for money.` },
        ];
    }

    return [
        { id: "ask_plan", label: `Ask about my ${header} plan`, message: `Tell me about my ${plan} (${header}) policy — what's covered, any gaps I should know about, and how I'm getting value for my premium.` },
        { id: "what_if", label: "What-if scenarios", intent: "WHAT_IF" },
        { id: "maths", label: "Run the maths", message: `Help me understand the maths on my ${plan} policy — I'm paying ${policy.premium} for ${policy.cover} cover. What happens to my premium if I increase or decrease my cover?` },
    ];
}

export function createPolicyContextMessage(policy, isCatalogue) {
    const header = policy.type;
    const plan = policy.plan;
    const greeting = isCatalogue
        ? `I see you're looking at **${plan}** — our ${header} offering. I can help you understand why it might be the right fit, explore what-if scenarios, or crunch the numbers. What would you like to do?`
        : `I can help with your **${plan}** ${header} policy. Choose an option below and I'll guide you from there.`;
    return {
        id: nextId(),
        sender: "bot",
        text: greeting,
        actionOptions: buildPolicyOptions(policy, isCatalogue),
    };
}

function parseNumber(text) {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

function requestsWhatIfCalculation(text) {
    const normalized = text.toLowerCase().replace(/[’']/g, "");
    const asksForMath = /\b(what if|what-if|calculate|calculation|calculations|math|maths|simulate|simulation|estimate|work out|run the numbers|crunch the numbers)\b/.test(normalized);
    const asksForPremiumScenario = /\b(premium|what if|what-if|simulate|simulation|increase cover|decrease cover|change cover|sum assured)\b/.test(normalized);
    const asksForEligibility = /\b(qualify|qualifies|qualified|eligible|eligibility|underwriting)\b/.test(normalized);

    // Explicit calculation requests should enter the inline maths flow even when
    // the user is asking whether they qualify. The calculator estimates premiums;
    // its opening message makes clear that it cannot decide underwriting eligibility.
    if (asksForEligibility && !asksForMath && !asksForPremiumScenario) return false;
    return asksForMath
        || /\b(increase|decrease|reduce|raise|change)\b.{0,45}\b(cover|premium|sum assured)\b/.test(normalized)
        || /\b(cover|premium|sum assured)\b.{0,45}\b(increase|decrease|reduce|raise|change)\b/.test(normalized);
}

let _msgId = 0;
function nextId() { return ++_msgId; }

const THINK_MS = 750;

function thinkDelay(ms = THINK_MS) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function useChat({
    activeConversation,
    setActiveConversation,
    setMessages,
    setConversations,
    isLoading,
    setIsLoading,
}) {
    const { user, clearAuth } = useAuth();
    const [wiStep, setWiStep] = useState(WI_STEPS.IDLE);
    const [wiData, setWiData] = useState({});

    function botMsg(text, extra = {}) {
        return { id: nextId(), sender: "bot", text, ...extra };
    }
    function userMsg(text) {
        return { id: nextId(), sender: "user", text };
    }

    async function beginWhatIfFlow(convId, { eligibilityQuestion = false } = {}) {
        setIsLoading(true);
        await thinkDelay();
        setWiData({});
        setWiStep(WI_STEPS.AWAIT_CURRENT_PREMIUM);
        const intro = eligibilityQuestion
            ? "I can work through a premium estimate with you right here. It can help you explore cover and cost, but it cannot tell you whether you qualify; the insurer decides that through underwriting.\n\nFirst, what is your **current monthly premium** in Rand? You can find it on your policy schedule or debit order."
            : "I can work through a premium estimate with you right here and compare cover amounts. It is an illustration, not a final quote or an eligibility decision.\n\nFirst, what is your **current monthly premium** in Rand? You can find it on your policy schedule or debit order.";
        const msg = botMsg(intro);
        setMessages(prev => [...prev, msg]);
        if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
        setIsLoading(false);
    }

    async function ensureConversation(firstMessage) {
        if (activeConversation) return activeConversation;
        try {
            const conv = await createConversation(user?.id, firstMessage.slice(0, 45) || "New Conversation");
            setActiveConversation(conv.id);
            setConversations(prev => [conv, ...prev]);
            return conv.id;
        } catch (err) {
            if (err.code === "UNAUTHORIZED") { clearAuth(); window.location.href = "/login"; }
            return null;
        }
    }

    // ── What-If state machine ─────────────────────────────────────────────────
    async function handleWhatIfStep(text, convId) {
        const num = parseNumber(text);

        if (wiStep === WI_STEPS.AWAIT_CURRENT_PREMIUM) {
            if (!num || num <= 0) {
                const msg = botMsg("That doesn't look right — please enter your monthly premium as a number, for example **620**.");
                setMessages(prev => [...prev, msg]);
                if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
                return true;
            }
            setWiData(d => ({ ...d, currentPremium: num }));
            setWiStep(WI_STEPS.AWAIT_CURRENT_COVER);
            const msg = botMsg(
                `Got it — **R ${num.toLocaleString("en-ZA")}/month**. Now, what is your current sum assured? That's the total cover amount on your policy right now. You can pick one of the common plan amounts below, or just type your own.`,
                { chips: "cover_current" }
            );
            setMessages(prev => [...prev, msg]);
            if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
            return true;
        }

        if (wiStep === WI_STEPS.AWAIT_CURRENT_COVER) {
            if (!num || num <= 0) {
                const msg = botMsg("Please enter a valid cover amount — for example **1500000** for R 1.5 million.");
                setMessages(prev => [...prev, msg]);
                if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
                return true;
            }
            setWiData(d => ({ ...d, currentSumAssured: num }));
            setWiStep(WI_STEPS.AWAIT_REQUESTED_COVER);
            const msg = botMsg(
                `Noted — your current cover is **R ${num.toLocaleString("en-ZA")}**. Now, what cover amount would you like to explore? Here are the available plan tiers — each one shows the plan name so you know exactly what you'd be moving to.`,
                { chips: "cover_requested" }
            );
            setMessages(prev => [...prev, msg]);
            if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
            return true;
        }

        if (wiStep === WI_STEPS.AWAIT_REQUESTED_COVER) {
            if (!num || num <= 0) {
                const msg = botMsg("Please enter a valid cover amount, or tap one of the options above.");
                setMessages(prev => [...prev, msg]);
                if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
                return true;
            }
            setWiData(d => ({ ...d, requestedSumAssured: num }));
            setWiStep(WI_STEPS.AWAIT_WAITING_PERIOD);
            const msg = botMsg(
                `Perfect — **R ${num.toLocaleString("en-ZA")}** it is. Last thing: would you like to apply a waiting period? A longer waiting period lowers your premium, but it means your full benefits only kick in after that time. Tap an option or type the number of months.`,
                { chips: "waiting_period" }
            );
            setMessages(prev => [...prev, msg]);
            if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
            return true;
        }

        if (wiStep === WI_STEPS.AWAIT_WAITING_PERIOD) {
            const allowed = [0, 3, 6, 12, 24];
            const months = parseInt(text.trim(), 10);
            if (!allowed.includes(months)) {
                const msg = botMsg("Please tap one of the waiting period options, or type **0**, **3**, **6**, **12**, or **24**.");
                setMessages(prev => [...prev, msg]);
                if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
                return true;
            }
            await runSimulation({ ...wiData, waitingPeriodMonths: months }, convId);
            return true;
        }

        return false;
    }

    async function runSimulation(payload, convId) {
        setWiStep(WI_STEPS.IDLE);
        setWiData({});
        setIsLoading(true);
        try {
            const result = await apiFetch("/api/what-if/simulate", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const fmt = n => `R ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const reply =
                `Here's what your simulation looks like:\n\n` +
                `**Estimated new premium:** ${fmt(result.estimatedPremium)}/month\n` +
                `**Waiting period:** ${result.waitingPeriodMonths === 0 ? "None" : result.waitingPeriodMonths + " months"}\n` +
                `**Factor applied:** ${result.appliedFactor}\n\n` +
                `${result.tradeOffSummary}\n\n` +
                `This is a simulation only — not a final quote and it cannot confirm eligibility. Your actual premium and acceptance depend on underwriting. Would you like to talk to an adviser, or run another simulation?`;
            setMessages(prev => [...prev, botMsg(reply)]);
            if (convId) saveMessage(convId, "bot", reply).catch(() => {});
        } catch {
            const errMsg = "I wasn't able to run that simulation right now. Please try again in a moment.";
            setMessages(prev => [...prev, botMsg(errMsg)]);
            if (convId) saveMessage(convId, "bot", errMsg).catch(() => {});
        } finally {
            setIsLoading(false);
        }
    }

    // ── Chip tap handler (called from MessageList) ────────────────────────────
    async function onChipSelect(chipType, value, label, convId) {
        const text = String(value);
        setMessages(prev => [...prev, userMsg(label)]);
        if (convId) saveMessage(convId, "user", label).catch(() => {});
        setIsLoading(true);
        await thinkDelay();
        await handleWhatIfStep(text, convId);
        setIsLoading(false);
    }

    // ── Policy / catalogue option tap ─────────────────────────────────────────
    async function onActionSelect(option, convId) {
        setMessages(prev => [...prev, userMsg(option.label)]);
        if (convId) saveMessage(convId, "user", option.label).catch(() => {});

        if (option.intent === "WHAT_IF") {
            await beginWhatIfFlow(convId);
            return;
        }

        setIsLoading(true);
        try {
            const data = await ragChat(option.message, convId ? String(convId) : undefined, user);
            const reply = data.reply || data.answer || "No response";
            setMessages(prev => [...prev, botMsg(reply)]);
            if (convId) saveMessage(convId, "bot", reply).catch(() => {});
        } catch (err) {
            if (err.code === "UNAUTHORIZED") { clearAuth(); window.location.href = "/login"; return; }
            setMessages(prev => [...prev, botMsg(chatFailureMessage(err))]);
        } finally {
            setIsLoading(false);
        }
    }

    // ── Policy context flow (from Home / catalogue) ───────────────────────────
    async function startPolicyContextFlow({ policy, isCatalogue, skipSetMessages = false }) {
        if (!skipSetMessages) {
            setMessages([createPolicyContextMessage(policy, isCatalogue)]);
        }
        const convId = await ensureConversation(policy.plan);
        const msg = createPolicyContextMessage(policy, isCatalogue);
        if (convId) saveMessage(convId, "bot", msg.text).catch(() => {});
    }

    // ── Main send ─────────────────────────────────────────────────────────────
    async function sendText(text) {
        if (!text?.trim() || isLoading) return;
        const convId = await ensureConversation(text);
        setMessages(prev => [...prev, userMsg(text)]);
        if (convId) saveMessage(convId, "user", text).catch(() => {});
        if (wiStep !== WI_STEPS.IDLE) {
            setIsLoading(true);
            await thinkDelay();
            await handleWhatIfStep(text, convId);
            setIsLoading(false);
            return;
        }
        if (requestsWhatIfCalculation(text)) {
            const asksEligibility = /\b(qualify|qualifies|qualified|eligible|eligibility|underwriting)\b/i.test(text);
            await beginWhatIfFlow(convId, { eligibilityQuestion: asksEligibility });
            return;
        }
        setIsLoading(true);
        try {
            const data = await ragChat(text, convId ? String(convId) : undefined, user);
            const reply = data.reply || data.answer || "No response";
            setMessages(prev => [...prev, botMsg(reply)]);
            if (convId) saveMessage(convId, "bot", reply).catch(() => {});
        } catch (err) {
            if (err.code === "UNAUTHORIZED") { clearAuth(); window.location.href = "/login"; return; }
            setMessages(prev => [...prev, botMsg(chatFailureMessage(err))]);
        } finally {
            setIsLoading(false);
        }
    }

    // ── Quick-start card handler ──────────────────────────────────────────────
    async function startQuickFlow(card) {
        const convId = await ensureConversation(card.title);
        setMessages(prev => [...prev, userMsg(card.firstMessage)]);
        if (convId) saveMessage(convId, "user", card.firstMessage).catch(() => {});

        if (card.intent === "WHAT_IF") {
            await beginWhatIfFlow(convId);
            return;
        }

        setIsLoading(true);
        try {
            const data = await ragChat(card.firstMessage, convId ? String(convId) : undefined, user);
            const reply = data.reply || data.answer || "No response";
            setMessages(prev => [...prev, botMsg(reply)]);
            if (convId) saveMessage(convId, "bot", reply).catch(() => {});
        } catch (err) {
            if (err.code === "UNAUTHORIZED") { clearAuth(); window.location.href = "/login"; return; }
            setMessages(prev => [...prev, botMsg(chatFailureMessage(err))]);
        } finally {
            setIsLoading(false);
        }
    }

    return { sendText, startQuickFlow, startPolicyContextFlow, onChipSelect, onActionSelect, wiStep, activeConversation };
}
