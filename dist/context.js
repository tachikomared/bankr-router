import { createHash } from "node:crypto";
const MAX_SESSIONS = 1000;
const sessionStore = new Map();
function normalizePrompt(prompt) {
    return prompt.trim().toLowerCase();
}
export function getSessionId(req, body) {
    const headerSession = req.headers["x-session-id"];
    if (typeof headerSession === "string" && headerSession.trim()) {
        return headerSession.trim();
    }
    const hints = {
        model: body?.model ?? "",
        system: body?.messages?.find?.((m) => m?.role === "system")?.content ?? "",
        channel: req.headers["x-channel-id"],
        chat: req.headers["x-chat-id"],
        user: req.headers["x-user-id"],
        client: req.headers["x-client-id"],
    };
    const seed = JSON.stringify(hints);
    return createHash("sha256").update(seed).digest("hex");
}
export function isFollowupPrompt(prompt, maxChars) {
    const text = normalizePrompt(prompt);
    if (!text || text.length > maxChars)
        return false;
    const followups = new Set([
        "yes",
        "ok",
        "okay",
        "continue",
        "go ahead",
        "do it",
        "fix it",
        "try again",
        "sure",
        "yep",
        "да",
        "ага",
        "сделай",
        "продолжай",
    ]);
    if (followups.has(text))
        return true;
    return /^(yes|ok|okay|sure|go ahead|continue|do it|try again)$/i.test(text);
}
export function getConversationState(sessionId) {
    return sessionStore.get(sessionId);
}
export function setConversationState(sessionId, state) {
    sessionStore.set(sessionId, state);
    if (sessionStore.size <= MAX_SESSIONS)
        return;
    const entries = Array.from(sessionStore.entries());
    entries.sort((a, b) => a[1].lastUpdatedAt - b[1].lastUpdatedAt);
    for (let i = 0; i < entries.length - MAX_SESSIONS; i++) {
        sessionStore.delete(entries[i][0]);
    }
}
