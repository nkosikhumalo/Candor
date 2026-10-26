package com.candor.companion.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Retrieval: embed the user's question, compare against stored chunk vectors,
 * and return only matches that clear RagProperties.similarityThreshold.
 *
 * Claims Mode path (deceasedFlag == true) calls {@link #retrieveForClaims}
 * which filters the database query to category == DEATH_CLAIMS before any
 * cosine scan — the AI physically cannot read address-update or premium rules
 * during a claims flow.
 */
@Service
public class RagRetrievalService {

    private static final Logger log = LoggerFactory.getLogger(RagRetrievalService.class);

    private final ChunkRepository repository;
    private final EmbeddingClient embeddingClient;
    private final RagProperties props;

    public RagRetrievalService(ChunkRepository repository, EmbeddingClient embeddingClient, RagProperties props) {
        this.repository = repository;
        this.embeddingClient = embeddingClient;
        this.props = props;
        if (props.isUseMock()) {
            log.info("[RagRetrieval] Keyword mode active; searching SQLite policy text. Embedding vectors are inactive because RAG_USE_MOCK=true.");
        } else {
            log.info("[RagRetrieval] Vector mode is active; using {} for query embeddings.", props.getEmbeddingModel());
        }
    }

    /**
     * Returns up to topK chunks relevant to the query.
     * - Mock mode: uses fast SQLite keyword search (avoids loading 23k vectors into RAM)
     * - Live mode: embeds the query and does cosine similarity against stored vectors
     */
    public List<RetrievedChunk> retrieve(String query) throws SQLException {
        if (props.isUseMock()) {
            List<StoredChunk> hits = repository.fetchByKeyword(query, props.getTopK());
            return toRetrievedChunks(hits);
        }
        return cosineScan(query, repository.fetchAllWithEmbeddings());
    }

    /**
     * Claims Mode retrieval — ONLY searches chunks tagged DEATH_CLAIMS.
     *
     * This physically prevents the AI from reading address-update rules,
     * premium recalculation logic, or any other section during a claims flow.
     * The query never touches non-death-claim rows in the database.
     */
    public List<RetrievedChunk> retrieveForClaims(String query) throws SQLException {
        log.info("[RagRetrieval] Claims-targeted retrieval — category=DEATH_CLAIMS only.");
        if (props.isUseMock()) {
            List<StoredChunk> hits = repository.fetchByKeywordAndCategory(
                    query, props.getTopK(), PolicyChunk.CATEGORY_DEATH_CLAIMS);
            return toRetrievedChunks(hits);
        }
        return cosineScan(query, repository.fetchWithEmbeddingsByCategory(PolicyChunk.CATEGORY_DEATH_CLAIMS));
    }

    /**
     * Convenience wrapper for the chat layer.
     * Returns a prompt-ready, source-labeled context block, or empty if nothing
     * cleared the threshold (caller should return the fallback without calling chat).
     *
     * @param claimsMode when true, restricts retrieval to DEATH_CLAIMS chunks only.
     */
    public Optional<String> buildGroundedContext(String query, boolean claimsMode) throws SQLException {
        List<RetrievedChunk> chunks = claimsMode ? retrieveForClaims(query) : retrieve(query);
        if (chunks.isEmpty()) {
            if (props.isUseMock()) {
                log.info("[RagRetrieval] Keyword search returned no policy chunks.");
            } else {
                log.info("[RagRetrieval] Vector search returned no chunks above similarity threshold {}.", props.getSimilarityThreshold());
            }
            return Optional.empty();
        }
        StringBuilder sb = new StringBuilder();
        int maxChars = Math.max(500, props.getMaxContextChars());
        for (RetrievedChunk c : chunks) {
            String label = "[Section: " + c.section()
                    + (c.subsection() != null ? " — " + c.subsection() : "") + "]";
            String piece = label + "\n" + c.content() + "\n\n";
            int remaining = maxChars - sb.length();
            if (remaining <= 0) break;
            if (piece.length() > remaining) {
                if (remaining > label.length() + 4) {
                    sb.append(piece, 0, remaining - 1).append("…");
                }
                break;
            }
            sb.append(piece);
        }
        return Optional.of(sb.toString().trim());
    }

    /** Backwards-compatible overload — standard retrieval, no category filter. */
    public Optional<String> buildGroundedContext(String query) throws SQLException {
        return buildGroundedContext(query, false);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private List<RetrievedChunk> toRetrievedChunks(List<StoredChunk> hits) {
        List<RetrievedChunk> results = new ArrayList<>();
        for (StoredChunk c : hits) {
            results.add(new RetrievedChunk(c.id(), c.section(), c.subsection(), c.content(), 1.0));
        }
        return results;
    }

    private List<RetrievedChunk> cosineScan(String query, List<StoredChunk> candidates) throws SQLException {
        float[] queryVector = embeddingClient.embed(query);
        List<RetrievedChunk> scored = new ArrayList<>();
        for (StoredChunk c : candidates) {
            double similarity = cosineSimilarity(queryVector, c.vector());
            if (similarity >= props.getSimilarityThreshold()) {
                scored.add(new RetrievedChunk(c.id(), c.section(), c.subsection(), c.content(), similarity));
            }
        }
        scored.sort(Comparator.comparingDouble(RetrievedChunk::similarity).reversed());
        return scored.size() > props.getTopK() ? scored.subList(0, props.getTopK()) : scored;
    }

    private double cosineSimilarity(float[] a, float[] b) {
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom == 0 ? 0.0 : dot / denom;
    }
}
