import { useState, useRef, useEffect } from "react";

function ChatInput({ sendText, isLoading, inputRef, isPreMember = false }) {
    const [text, setText] = useState("");
    const [listening, setListening] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Expose focus to parent via inputRef
    useEffect(() => {
        if (inputRef) inputRef.current = textareaRef.current;
    }, [inputRef]);

    // Auto-grow textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }, [text]);

    async function send() {
        if ((!text.trim() && !selectedFile) || isLoading) return;
        const userText = text.trim();
        setText("");
        setSelectedFile(null);
        await sendText(userText);
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function startListening() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert("Speech recognition not supported in this browser."); return; }
        const r = new SR();
        r.lang = "en-ZA";
        r.interimResults = true;
        r.continuous = false;
        r.onstart = () => setListening(true);
        r.onend = () => setListening(false);
        r.onerror = () => setListening(false);
        r.onresult = (e) => {
            let t = "";
            for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
            setText(t);
        };
        recognitionRef.current = r;
        r.start();
    }

    function stopListening() { recognitionRef.current?.stop(); }

    const canSend = (text.trim() || selectedFile) && !isLoading;

    return (
        <div className="input-wrap">
            <input type="file" hidden ref={fileInputRef}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => setSelectedFile(e.target.files[0] || null)} />

            <div className="input-inner">
                <button type="button" className="input-btn" title="Attach file"
                    onClick={() => fileInputRef.current.click()} aria-label="Attach file">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>

                <div className="input-field">
                    {selectedFile && (
                        <div className="selected-file">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13" style={{ marginRight: 5 }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                            </svg>
                            {selectedFile.name}
                            <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove file">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isLoading ? "Candor is thinking…" : isPreMember ? "Ask about MediCare benefits and cover options…" : "Ask Candor anything about your policy…"}
                        disabled={isLoading}
                    />
                </div>

                {canSend ? (
                    <button type="button" className="input-btn send" onClick={send}
                        disabled={isLoading} aria-label="Send message">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                        </svg>
                    </button>
                ) : (
                    <button type="button"
                        className={`input-btn ${listening ? "listening" : ""}`}
                        onClick={listening ? stopListening : startListening}
                        aria-label={listening ? "Stop recording" : "Start voice input"}>
                        {listening ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>
                )}
            </div>
            <p className="input-hint">Candor may make mistakes. Always verify important information.</p>
        </div>
    );
}

export default ChatInput;
