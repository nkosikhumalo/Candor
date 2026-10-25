import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import { useAuth } from "../context/AuthContext";
import { useChat, createPolicyContextMessage } from "../hooks/useChat";
import { getConversations, getMessages } from "../services/chatService";

import "../styles/chat.css";

function getInitialMessages(state) {
    if (state?.policyCard) return [createPolicyContextMessage(state.policyCard, false)];
    if (state?.catalogueCard) return [createPolicyContextMessage(state.catalogueCard, true)];
    return [];
}

function Chat({ popup = false, onClose }) {
    const { token, user, authReady } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const userId = user?.id;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [messages, setMessages] = useState(() => getInitialMessages(location.state));
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const policyFlowStarted = useRef(false);
    const starterQuestionSent = useRef(false);

    const { sendText, startQuickFlow, startPolicyContextFlow, onChipSelect, onActionSelect } = useChat({
        activeConversation,
        setActiveConversation,
        setMessages,
        setConversations,
        isLoading,
        setIsLoading,
    });

    useEffect(() => {
        const question = location.state?.starterQuestion;
        if (!authReady || !token || !question || starterQuestionSent.current) return;
        starterQuestionSent.current = true;
        void sendText(question);
        navigate("/chat", {
            replace: true,
            state: location.state?.backgroundLocation
                ? { backgroundLocation: location.state.backgroundLocation }
                : null,
        });
    }, [authReady, token, location.state, navigate, sendText]);

    const loadConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await getConversations(userId);
            setConversations(Array.isArray(data) ? data : []);
        } catch (err) {
            if (err.code === "UNAUTHORIZED") navigate("/login");
        }
    }, [userId, navigate]);

    useEffect(() => {
        if (!authReady) return;
        if (!token) { navigate("/login"); return; }
        queueMicrotask(() => { void loadConversations(); });
    }, [token, authReady, loadConversations, navigate]);

    // Bootstrap policy flow immediately — messages already set synchronously on mount
    useLayoutEffect(() => {
        const state = location.state;
        if (!state || policyFlowStarted.current) return;
        if (!state.policyCard && !state.catalogueCard) return;

        policyFlowStarted.current = true;
        const policy = state.policyCard || state.catalogueCard;
        const isCatalogue = !!state.catalogueCard;
        navigate("/chat", {
            replace: true,
            state: location.state?.backgroundLocation
                ? { backgroundLocation: location.state.backgroundLocation }
                : null,
        });
        startPolicyContextFlow({ policy, isCatalogue, skipSetMessages: true });
    }, [location.state, navigate, startPolicyContextFlow]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    async function loadMessages(conversationId) {
        if (!conversationId) return;
        try {
            const data = await getMessages(conversationId);
            const rows = Array.isArray(data) ? data : [];
            setMessages(rows.map(r => ({ ...r, text: r.message || r.text })));
        } catch (err) {
            console.error("Failed loading messages:", err);
        }
    }

    function startNewChat() {
        setActiveConversation(null);
        setMessages([]);
    }

    useEffect(() => {
        if (!popup) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const closeOnEscape = (event) => {
            if (event.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [popup, onClose]);

    const chatPanel = (
        <div className={`chat-app${popup ? " chat-app-popup" : ""}`}
            role={popup ? "dialog" : undefined}
            aria-modal={popup ? "true" : undefined}
            aria-label={popup ? "Chat with Candor" : undefined}>
            <Sidebar
                open={sidebarOpen}
                close={() => setSidebarOpen(false)}
                conversations={conversations}
                activeConversation={activeConversation}
                setActiveConversation={(id) => {
                    setActiveConversation(id);
                    loadMessages(id);
                }}
                loadMessages={loadMessages}
                onNewChat={startNewChat}
                setConversations={setConversations}
            />

            <div className="chat-main">
                <ChatHeader openSidebar={() => setSidebarOpen(true)} onClose={popup ? onClose : undefined} />

                <MessageList
                    messages={messages}
                    isLoading={isLoading}
                    bottomRef={bottomRef}
                    onQuickStart={startQuickFlow}
                    onFocusInput={() => inputRef.current?.focus()}
                    onChipSelect={onChipSelect}
                    onActionSelect={onActionSelect}
                    activeConversation={activeConversation}
                    userName={user?.first_name || user?.username || "You"}
                />

                <ChatInput
                    sendText={sendText}
                    isLoading={isLoading}
                    inputRef={inputRef}
                />
            </div>
        </div>
    );

    if (!popup) return chatPanel;

    return (
        <div className="chat-popup-backdrop" onClick={(event) => {
            if (event.target === event.currentTarget) onClose?.();
        }}>
            {chatPanel}
        </div>
    );
}

export default Chat;
