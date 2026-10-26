import { apiFetch } from "./api";
import { isPreMemberAccount } from "./accountStatus";

export async function ragChat(question, conversationId, user) {
    // Keep this in sync with the account routing rules. In particular, users
    // awaiting review are still pre-members and must not hit member-only chat.
    const endpoint = isPreMemberAccount(user)
        ? "/api/rag/pre-member-chat"
        : "/api/rag/chat";
    const request = () => apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ question, conversationId }),
    });
    let data;
    try {
        data = await request();
    } catch (error) {
        // Java's RAG controller does not emit 429 responses; these are
        // transient upstream/hosting limits. Retry once after the suggested
        // delay so a temporary edge limit does not immediately fail chat.
        if (error?.status !== 429) throw error;
        const retryAfter = Number(error.retryAfter);
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 5000)
            : 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        data = await request();
    }
    // Backend returns { answer, conversationId }
    return { ...data, reply: data.answer };
}
