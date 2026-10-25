package com.candor.companion.rag;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Central configuration for the RAG module, bound from application.properties
 * under the "rag.*" prefix. Keeping these as named, bound properties (rather
 * than magic numbers scattered through the code) makes every design decision
 * traceable back to SUBMISSION.md.
 *
 * Add to application.properties (defaults shown match what's used if omitted):
 *
 *   rag.db-path=policy_rag.db
 *   rag.chat-model=anthropic.claude-3-haiku-20240307-v1:0
 *   rag.embedding-model=amazon.titan-embed-text-v2:0
 *   rag.embedding-dims=1024
 *   rag.max-chunk-tokens=350
 *   rag.chunk-overlap-tokens=40
 *   rag.top-k=4
 *   rag.similarity-threshold=0.55
 *   rag.use-mock=true
 *   rag.smoke-test=false
 */
@Component
@ConfigurationProperties(prefix = "rag")
public class RagProperties {

    private String dbPath = "policy_rag.db";
    private String chatModel = "anthropic.claude-3-haiku-20240307-v1:0";
    private String embeddingModel = "amazon.titan-embed-text-v2:0";
    private int embeddingDims = 1024;

    // Chunking
    private int maxChunkTokens = 350;
    private int chunkOverlapTokens = 40;

    // Retrieval / grounding
    private int topK = 4;
    private int maxContextChars = 8000;
    // Cosine similarity floor. Below this, we treat the corpus as "not
    // containing an answer" and trigger the fallback rather than pass weak
    // matches to the model. Needs tuning against real sample questions
    // before Finals — treat as a starting point, not final.
    private double similarityThreshold = 0.55;
    private String fallbackResponse =
            "I can't confirm that from the provided documents. "
            + "I can explain what is available or refer this for human review.";

    // Toggle: true = MockEmbeddingClient (no live gateway needed), false = GatewayEmbeddingClient
    private boolean useMock = true;

    // Toggle: run RagSmokeTestRunner on startup (off by default)
    private boolean smokeTest = false;

    public String getDbPath() { return dbPath; }
    public void setDbPath(String dbPath) { this.dbPath = dbPath; }

    public String getChatModel() { return chatModel; }
    public void setChatModel(String chatModel) { this.chatModel = chatModel; }

    public String getEmbeddingModel() { return embeddingModel; }
    public void setEmbeddingModel(String embeddingModel) { this.embeddingModel = embeddingModel; }

    public int getEmbeddingDims() { return embeddingDims; }
    public void setEmbeddingDims(int embeddingDims) { this.embeddingDims = embeddingDims; }

    public int getMaxChunkTokens() { return maxChunkTokens; }
    public void setMaxChunkTokens(int maxChunkTokens) { this.maxChunkTokens = maxChunkTokens; }

    public int getChunkOverlapTokens() { return chunkOverlapTokens; }
    public void setChunkOverlapTokens(int chunkOverlapTokens) { this.chunkOverlapTokens = chunkOverlapTokens; }

    public int getTopK() { return topK; }
    public void setTopK(int topK) { this.topK = topK; }

    public int getMaxContextChars() { return maxContextChars; }
    public void setMaxContextChars(int maxContextChars) { this.maxContextChars = maxContextChars; }

    public double getSimilarityThreshold() { return similarityThreshold; }
    public void setSimilarityThreshold(double similarityThreshold) { this.similarityThreshold = similarityThreshold; }

    public String getFallbackResponse() { return fallbackResponse; }
    public void setFallbackResponse(String fallbackResponse) { this.fallbackResponse = fallbackResponse; }

    public boolean isUseMock() { return useMock; }
    public void setUseMock(boolean useMock) { this.useMock = useMock; }

    public boolean isSmokeTest() { return smokeTest; }
    public void setSmokeTest(boolean smokeTest) { this.smokeTest = smokeTest; }
}
