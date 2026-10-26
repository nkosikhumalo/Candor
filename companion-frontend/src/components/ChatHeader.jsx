import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

function ChatHeader({ openSidebar, onClose, homePath = "/home", audienceLabel = "AI ASSISTANT" }) {
    const navigate = useNavigate();
    const { darkMode, toggleTheme } = useTheme();

    return (
        <header className="chat-header">
            <div className="header-left">
                <button className="menu-btn" onClick={openSidebar} aria-label="Open conversations">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <button className="back-home-btn" onClick={onClose || (() => navigate(homePath))} aria-label={onClose ? "Close chat" : "Return home"}>
                    {onClose ? "Close" : (
                        <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" style={{ marginRight: 4 }}>
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Home
                        </>
                    )}
                </button>
            </div>

            <div className="brand">
                <div className="brand-name">Medi<span>Care</span><span className="brand-dot">.</span></div>
                <div className="brand-sub">{audienceLabel}</div>
            </div>

            <div className="controls">
                <button onClick={toggleTheme} aria-label="Toggle theme" title={darkMode ? "Light mode" : "Dark mode"}>
                    {darkMode ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
}

export default ChatHeader;
