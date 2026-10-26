package com.candor.companion.rag;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * RagStartupLoader
 *
 * Runs automatically at Spring Boot startup via @PostConstruct.
 *
 * What happens here:
 * 1. Reads the policy document from src/main/resources/ (classpath-safe,
 *    works inside a JAR across all laptops — no relative file paths).
 * 2. Passes the raw text to PolicyChunker to split it into structured chunks.
 * 3. Passes the chunks to RagIngestionService which:
 *      a. Sends each chunk to the AI Gateway to get its embedding vector.
 *      b. Stores the chunk + vector in SQLite (policy_rag.db).
 * 4. Logs success or failure clearly so startup issues are immediately visible.
 *
 * After this runs, the SQLite store is ready for RagRetrievalService to
 * serve cosine-similarity queries at request time.
 *
 * NOTE: Only ingests if the document has not been ingested before
 * (checked by document filename + version) to avoid re-embedding on
 * every restart.
 *
 * TODO: wire PolicyChunker.splitIntoSections() once implemented,
 * and swap the PDF extraction step for a real PDF-to-text parser.
 */
@Component
public class RagStartupLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RagStartupLoader.class);

    // Update this version string whenever the source document changes
    // to force a re-ingestion on next startup.
    private static final String DOCUMENT_VERSION = "v3.2";
    private static final String DOCUMENT_FILENAME = "Myriad_Technical_Guide.md";

    private final RagIngestionService ingestionService;
    private final PolicyChunker chunker;

    public RagStartupLoader(RagIngestionService ingestionService, PolicyChunker chunker) {
        this.ingestionService = ingestionService;
        this.chunker = chunker;
    }

    /**
     * Run ingestion after Spring has created and bound the web server. Render
     * detects a service by its open port; doing this work in @PostConstruct
     * held application-context creation open, so Render saw no port while a
     * newer policy-guide version was being indexed.
     */
    @Override
    public void run(ApplicationArguments args) {
        log.info("[RAG] Starting policy document ingestion...");
        try {
            ClassPathResource resource = new ClassPathResource(DOCUMENT_FILENAME);
            if (!resource.exists()) {
                log.warn("[RAG] Document not found on classpath: {}. Skipping ingestion.", DOCUMENT_FILENAME);
                return;
            }

            // Skip re-ingestion if this version is already stored
            if (ingestionService.isAlreadyIngested(DOCUMENT_FILENAME, DOCUMENT_VERSION)) {
                log.info("[RAG] Document '{}' version '{}' already ingested — skipping.", DOCUMENT_FILENAME, DOCUMENT_VERSION);
            } else {
                try (InputStream inputStream = resource.getInputStream()) {
                    byte[] bytes = inputStream.readAllBytes();
                    // MD file — clean UTF-8, read directly.
                    String rawText = new String(bytes, StandardCharsets.UTF_8);

                    List<PolicyChunk> chunks = chunker.chunkDocument(rawText);
                    ingestionService.ingestDocument(DOCUMENT_FILENAME, DOCUMENT_VERSION, chunks);
                    log.info("[RAG] Ingestion complete. {} chunks stored.", chunks.size());
                }
            }

            int removedVersions = ingestionService.removeOtherVersions(DOCUMENT_FILENAME, DOCUMENT_VERSION);
            if (removedVersions > 0) {
                log.info("[RAG] Removed {} stale document versions after loading {}.", removedVersions, DOCUMENT_VERSION);
            }

        } catch (Exception e) {
            log.error("[RAG] Ingestion failed: {}", e.getMessage(), e);
        }
    }
}
