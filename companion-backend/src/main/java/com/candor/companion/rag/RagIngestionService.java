package com.candor.companion.rag;

import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

/**
 * Ingestion pipeline: chunk -> embed -> store.
 *
 * Intended to run once (offline / at build time) per document, not per
 * query — this keeps query-time latency down to "embed the user's
 * question" only, matching the precompute design decision in
 * SUBMISSION.md.
 */
@Service
public class RagIngestionService {

    private final ChunkRepository repository;
    private final EmbeddingClient embeddingClient;

    public RagIngestionService(ChunkRepository repository, EmbeddingClient embeddingClient) {
        this.repository = repository;
        this.embeddingClient = embeddingClient;
    }

    public void ingestDocument(String filename, String version, List<PolicyChunk> chunks) throws SQLException {
        long documentId = repository.insertDocument(filename, version);
        for (PolicyChunk chunk : chunks) {
            long chunkId = repository.insertChunk(documentId, chunk);
            float[] vector = embeddingClient.embed(chunk.getContent());
            repository.insertEmbedding(chunkId, vector);
        }
    }

    public boolean isAlreadyIngested(String filename, String version) throws SQLException {
        return repository.documentExists(filename, version);
    }

    public int removeOtherVersions(String filename, String keepVersion) throws SQLException {
        return repository.deleteOtherDocumentVersions(filename, keepVersion);
    }
}
