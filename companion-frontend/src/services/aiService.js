import { apiFetch } from "./api";
import { isPreMemberAccount } from "./accountStatus";

export async function ragChat(question, conversationId, user) {
    // Keep this in sync with the account routing rules. In particular, users
    // awaiting review are still pre-members and must not hit member-only chat.
    const endpoint = isPreMemberAccount(user)
        ? "/api/rag/pre-member-chat"
        : "/api/rag/chat";
    const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ question, conversationId }),
    });
    // Backend returns { answer, conversationId }
    return { ...data, reply: data.answer };
}
