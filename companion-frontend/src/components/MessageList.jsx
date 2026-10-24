import { useState } from "react";
import ReactMarkdown from "react-markdown";
import Welcome from "./Welcome";
import { COVER_OPTIONS, WAITING_OPTIONS } from "../hooks/useChat";

function ChatUserAvatar({ size = 22 }) {
    return (
        <span className="bubble-avatar bubble-avatar-user" aria-hidden="true">
            <svg
                width={size}
                height={size}
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="chat-user-avatar-svg"
            >
                <circle cx="20" cy="20" r="20" className="chat-avatar-bg" />
                <circle cx="20" cy="14" r="5.5" className="chat-avatar-figure" />
                <path d="M8 32 Q8 22 20 22 Q32 22 32 32" className="chat-avatar-figure" />
            </svg>
        </span>
    );
}

function ChatBotAvatar() {
    return <span className="bubble-avatar bubble-avatar-bot" aria-hidden="true">M</span>;
}

function sentenceParagraphs(text) {
    return text
        .split(/\n{2,}/)
        .flatMap(block => block.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
        .map(block => block.trim())
        .filter(Boolean)
        .join("\n\n");
}

function formatAssistantMessage(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    // Preserve AI output that already contains Markdown list/heading structure.
    if (/^\s*(#{1,6}\s|[-*]\s+|\d+[.)]\s+|>\s)/m.test(text)) return text;

    // Turn colon-led, semicolon-separated cover groups into bold section labels
    // and individual bullets. This also cleans up messages saved before the
    // backend started returning structured Markdown.
    const colon = text.match(/^([\s\S]*?:)\s+([\s\S]+)$/);
    if (colon) {
        const clauses = colon[2].split(/;\s*/);
        if (clauses.length >= 3) {
            const finalClause = clauses.pop().trim();
            const endOfLastItem = finalClause.search(/[.!?](?:\s|$)/);
            const lastItem = endOfLastItem < 0 ? finalClause : finalClause.slice(0, endOfLastItem + 1);
            const trailingText = endOfLastItem < 0 ? "" : finalClause.slice(endOfLastItem + 1).trim();
            clauses.push(lastItem);

            const formattedClauses = clauses.map(clause => {
                let item = clause.trim().replace(/[.;]+$/, "").replace(/^and\s+/i, "");
                let heading;
                let covers;

                const benefitGroup = item.match(/^(.+?\s+benefits?)\s*\(([^)]+)\)$/i);
                if (benefitGroup) {
                    heading = benefitGroup[1];
                    covers = benefitGroup[2];
                } else {
                    const options = item.match(/^options?\s+(?:such as|including)\s+(.+)$/i);
                    if (!options) return `- ${item}`;
                    heading = "Additional options";
                    covers = options[1];
                }

                const points = covers.split(/,\s*/).map(cover => `  - ${cover.trim()}`).join("\n");
                return `**${heading}**\n${points}`;
            });

            return [sentenceParagraphs(colon[1]), ...formattedClauses, trailingText ? sentenceParagraphs(trailingText) : ""]
                .filter(Boolean)
                .join("\n\n");
        }
    }

    return sentenceParagraphs(text);
}

function SpeakerBtn({ text }) {
    const [speaking, setSpeaking] = useState(false);
    function toggle() {
        if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-ZA";
        const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("en"));
        if (v) u.voice = v;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
        setSpeaking(true);
    }
    return (
        <button type="button" className={`msg-speak-btn ${speaking ? "msg-speak-active" : ""}`}
            onClick={toggle} aria-label={speaking ? "Stop reading" : "Read aloud"}>
            {speaking ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                    <rect x="6" y="6" width="4" height="12" rx="1" fill="currentColor" stroke="none" />
                    <rect x="14" y="6" width="4" height="12" rx="1" fill="currentColor" stroke="none" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
            )}
        </button>
    );
}

function Chips({ type, onSelect }) {
    const options = type === "waiting_period" ? WAITING_OPTIONS : COVER_OPTIONS;
    return (
        <div className="msg-chips">
            {options.map(o => (
                <button key={o.value} className="msg-chip" type="button"
                    onClick={() => onSelect(type, o.value, o.label)}>
                    <span className="msg-chip-label">{o.label}</span>
                    {o.plan && <span className="msg-chip-sub">{o.plan}</span>}
                </button>
            ))}
        </div>
    );
}

function ActionOptions({ options, onSelect }) {
    return (
        <div className="msg-chips">
            {options.map(o => (
                <button key={o.id} className="msg-chip" type="button"
                    onClick={() => onSelect(o)}>
                    <span className="msg-chip-label">{o.label}</span>
                </button>
            ))}
        </div>
    );
}

function MessageList({ messages, isLoading, bottomRef, onQuickStart, onFocusInput, onChipSelect, onActionSelect, activeConversation, userName }) {
    const isEmpty = messages.length === 0 && !isLoading;
    const displayUser = userName || "You";

    function renderBubble(msg) {
        const isBot = msg.sender === "bot";
        const name = isBot ? "MediCandor" : displayUser;

        return (
            <div className={`bubble ${isBot ? "bubble-bot" : "bubble-user"}`}>
                <div className="bubble-header">
                    {isBot ? <ChatBotAvatar /> : <ChatUserAvatar />}
                    <span className={`bubble-name ${isBot ? "bubble-name-bot" : "bubble-name-user"}`}>{name}</span>
                    {isBot && <span className="bubble-badge">AI</span>}
                </div>
                <div className="bubble-body">
                    {isBot ? (
                        <div className="assistant-markdown">
                            <ReactMarkdown>{formatAssistantMessage(msg.text || msg.message)}</ReactMarkdown>
                        </div>
                    ) : (
                        msg.text || msg.message
                    )}
                    {msg.actionOptions && (
                        <ActionOptions options={msg.actionOptions}
                            onSelect={(opt) => onActionSelect?.(opt, activeConversation)} />
                    )}
                    {msg.chips && (
                        <Chips type={msg.chips}
                            onSelect={(type, value, label) =>
                                onChipSelect?.(type, value, label, activeConversation)} />
                    )}
                    {isBot && (
                        <SpeakerBtn text={msg.text || msg.message || ""} />
                    )}
                </div>
            </div>
        );
    }

    return (
        <main className="chat-body">
            {isEmpty ? (
                <Welcome onQuickStart={onQuickStart} onFocusInput={onFocusInput} />
            ) : (
                <div className="messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message-row ${msg.sender}`}>
                            {renderBubble(msg)}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="message-row bot">
                            <div className="bubble bubble-bot bubble-thinking">
                                <div className="bubble-header">
                                    <ChatBotAvatar />
                                    <span className="bubble-name bubble-name-bot">MediCandor</span>
                                    <span className="bubble-badge">AI</span>
                                </div>
                                <div className="bubble-body bubble-thinking-body">
                                    <span className="thinking-dot" />
                                    <span className="thinking-dot" />
                                    <span className="thinking-dot" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            )}
        </main>
    );
}

export default MessageList;
