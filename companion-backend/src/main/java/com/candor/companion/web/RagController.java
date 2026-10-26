package com.candor.companion.web;

import com.candor.companion.domain.AuditLoggerService;
import com.candor.companion.domain.AuditLoggerService.AuditAction;
import com.candor.companion.domain.AuditLoggerService.AuditStatus;
import com.candor.companion.rag.GroundedChatService;
import com.candor.companion.rag.RagProperties;
import com.candor.companion.rag.RagRetrievalService;
import com.candor.companion.security.CompanionPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/rag")
public class RagController {

    private static final Logger log = LoggerFactory.getLogger(RagController.class);

    private final RagRetrievalService retrievalService;
    private final GroundedChatService groundedChatService;
    private final RagProperties props;
    private final AuditLoggerService auditLogger;

    public RagController(
            RagRetrievalService retrievalService,
            GroundedChatService groundedChatService,
            RagProperties props,
            AuditLoggerService auditLogger) {
        this.retrievalService = retrievalService;
        this.groundedChatService = groundedChatService;
        this.props = props;
        this.auditLogger = auditLogger;
    }

    /**
     * conversationId links this turn to its history in SessionMemoryStore.
     * Falls back to a userId-scoped key if the client omits it.
     */
    public record QueryRequest(String question, String conversationId) {}

    /** Raw retrieval — returns the top-k grounded context chunks. */
    @PostMapping("/query")
    public ResponseEntity<?> query(@RequestBody QueryRequest request,
                                   @AuthenticationPrincipal CompanionPrincipal principal) {
        String userId   = principal != null ? principal.subject()           : "anonymous";
        String policyId = principal != null ? principal.policyId()          : "unknown";
        String role     = principal != null ? principal.effectiveRole().name() : "unknown";

        try {
            Optional<String> context = retrievalService.buildGroundedContext(request.question());

            auditLogger.log(userId, policyId, role, AuditAction.RAG_QUERY,
                    Map.of("question", request.question(), "grounded", context.isPresent()));

            if (context.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "answer", props.getFallbackResponse(),
                        "grounded", false));
            }
            return ResponseEntity.ok(Map.of("answer", context.get(), "grounded", true));

        } catch (Exception e) {
            log.error("[RAG] Query failed subject={} policyId={}", userId, policyId, e);
            auditLogger.log(userId, policyId, role, AuditAction.RAG_QUERY,
                    Map.of("question", request.question(), "error", e.getMessage()),
                    false, AuditStatus.REJECTED);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** Full compliance chat pipeline. */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody QueryRequest request,
                                  @AuthenticationPrincipal CompanionPrincipal principal) {
        String userId      = principal != null ? principal.subject()              : "anonymous";
        String policyId    = principal != null ? principal.policyId()             : "unknown";
        String role        = principal != null ? principal.effectiveRole().name() : "unknown";
        boolean deceased   = principal != null && principal.deceasedFlag();

        // Prefer the client-supplied conversationId; fall back to user+policy scope
        String conversationId = (request.conversationId() != null && !request.conversationId().isBlank())
                ? request.conversationId()
                : userId + "::" + policyId;

        try {
            String answer = groundedChatService.answer(
                    request.question(), userId, policyId, role, deceased, conversationId);

            auditLogger.log(userId, policyId, role, AuditAction.RAG_CHAT,
                    Map.of("question", request.question(),
                           "conversationId", conversationId,
                           "answerLength", answer.length(),
                           "deceasedFlag", deceased,
                           "guardrailFired", answer.contains("I cannot confirm specific financial")));

            return ResponseEntity.ok(Map.of("answer", answer, "conversationId", conversationId));

        } catch (Exception e) {
            log.error("[RAG] Chat failed subject={} policyId={} conversationId={}",
                    userId, policyId, conversationId, e);
            auditLogger.log(userId, policyId, role, AuditAction.RAG_CHAT,
                    Map.of("question", request.question(), "error", e.getMessage()),
                    false, AuditStatus.REJECTED);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
