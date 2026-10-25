import { apiFetch } from "./api";

export async function ragChat(question, conversationId, membershipStatus) {
    const endpoint = membershipStatus === "PRE_MEMBER"
        ? "/api/rag/pre-member-chat"
        : "/api/rag/chat";
    const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ question, conversationId }),
    });
    // Backend returns { answer, conversationId }
    return { ...data, reply: data.answer };
}
