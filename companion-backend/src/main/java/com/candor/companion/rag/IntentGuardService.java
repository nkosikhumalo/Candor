package com.candor.companion.rag;

import com.candor.companion.domain.AuditLoggerService;
import com.candor.companion.domain.AuditLoggerService.AuditAction;
import com.candor.companion.domain.AuditLoggerService.AuditStatus;
import com.candor.companion.domain.CompanionRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * IntentGuardService — pre-LLM role-based intent gate.
 *
 * This runs BEFORE any vector retrieval or LLM call. If the request is
 * blocked here, zero tokens are consumed and the rejection is deterministic —
 * it cannot be prompt-injected around.
 *
 * Intent detection is keyword-based (fast, zero-cost). The LLM is never
 * consulted for authorization decisions — only for generating answers once
 * access is confirmed.
 *
 * Blocked intents for BENEFICIARY:
 *   - WHAT_IF_CALC   : cover/premium recalculation requests
 *   - POLICY_UPDATE  : address, banking, or beneficiary mutation requests
 */
@Service
public class IntentGuardService {

    private static final Logger log = LoggerFactory.getLogger(IntentGuardService.class);

    private final AuditLoggerService auditLogger;

    public IntentGuardService(AuditLoggerService auditLogger) {
        this.auditLogger = auditLogger;
    }

    // -------------------------------------------------------------------------
    // Keyword lists — extend here, never in the LLM prompt
    // -------------------------------------------------------------------------

    private static final List<String> WHAT_IF_KEYWORDS = List.of(
            "what if", "what-if", "recalculate", "recalculation",
            "increase cover", "increase my cover", "increase sum assured",
            "change premium", "adjust premium", "adjust cover",
            "new premium", "premium simulation", "cover simulation",
            "calculate", "calculation", "calculations", "maths", "math", "estimate",
            "simulate", "sum assured"
    );

    private static final List<String> POLICY_UPDATE_KEYWORDS = List.of(
            "update address", "change address", "change my address", "new address",
            "update bank", "change bank", "change my bank", "banking details",
            "change beneficiary", "update beneficiary", "add beneficiary",
            "remove beneficiary", "update contact", "change contact",
            "change email", "update email", "proof of residence"
    );

    private static final String BENEFICIARY_BLOCK_MESSAGE =
            "I'm sorry, I can't assist with that. "
            + "As a beneficiary, you have access to policy Q&A and claims support only. "
            + "Cover adjustments, premium recalculations, and policy updates require "
            + "policyholder authorisation. Please contact the primary policyholder or a "
            + "consultant for assistance.";

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Checks whether the given role is permitted to ask this question.
     *
     * @return null if access is allowed; a rejection message string if blocked.
     *         The caller must return the rejection message immediately — do NOT
     *         proceed to vector retrieval or LLM when this returns non-null.
     */
    public String checkAccess(String userQuestion, CompanionRole effectiveRole,
                               String userId, String policyId) {
        if (effectiveRole == CompanionRole.BENEFICIARY) {
            IntentCategory intent = detectIntent(userQuestion);
            if (intent == IntentCategory.WHAT_IF_CALC || intent == IntentCategory.POLICY_UPDATE) {
                log.warn("[IntentGuard] BLOCKED — role=BENEFICIARY intent={} subject={} policyId={}",
                        intent, userId, policyId);
                auditLogger.log(userId, policyId, effectiveRole.name(),
                        AuditAction.COMPLIANCE_GUARDRAIL_FIRED,
                        Map.of(
                                "stage", "pre_llm_intent_guard",
                                "intent", intent.name(),
                                "question_preview", userQuestion.length() > 80
                                        ? userQuestion.substring(0, 80) + "…"
                                        : userQuestion
                        ),
                        false, AuditStatus.REJECTED);
                return BENEFICIARY_BLOCK_MESSAGE;
            }
        }
        return null; // access granted
    }

    // -------------------------------------------------------------------------
    // Intent detection
    // -------------------------------------------------------------------------

    private IntentCategory detectIntent(String question) {
        String q = question.toLowerCase();
        if (WHAT_IF_KEYWORDS.stream().anyMatch(q::contains)) {
            return IntentCategory.WHAT_IF_CALC;
        }
        if (POLICY_UPDATE_KEYWORDS.stream().anyMatch(q::contains)) {
            return IntentCategory.POLICY_UPDATE;
        }
        return IntentCategory.POLICY_QA;
    }

    enum IntentCategory {
        POLICY_QA,
        CLAIMS_INFO,
        WHAT_IF_CALC,
        POLICY_UPDATE
    }
}
