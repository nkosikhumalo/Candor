package com.candor.companion.rag;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Markdown Structure-Aware Chunker
 *
 * Splits the policy .md file at heading boundaries (#, ##, ###, ####)
 * AND at legacy underscore-separator headings (e.g. "Cessions ________").
 * Sections that exceed maxChunkTokens are recursively sub-split at paragraph
 * then sentence boundaries with overlap, keeping context intact.
 *
 * Each chunk carries its section/subsection metadata so retrieved chunks
 * are self-labelled for the compliance prompt.
 */
@Component
public class PolicyChunker {

    // Matches ATX Markdown headings: # H1, ## H2, ### H3, #### H4
    private static final Pattern MD_HEADING =
            Pattern.compile("^(#{1,4})\\s+(.+?)\\s*$", Pattern.MULTILINE);

    // Legacy: heading text followed by 5+ underscores on the SAME line
    private static final Pattern UNDERSCORE_HEADING =
            Pattern.compile("^(?<heading>[A-Z][^\\n]{2,})_{5,}\\s*$", Pattern.MULTILINE);

    // Table row detection — keep table blocks atomic
    private static final Pattern TABLE_ROW =
            Pattern.compile("^\\|.+\\|\\s*$", Pattern.MULTILINE);

    private static final int MAX_CHUNK_CHARS = 1200;
    private static final int OVERLAP_CHARS   = 150;

    private final RagProperties props;

    public PolicyChunker(RagProperties props) {
        this.props = props;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public List<PolicyChunk> chunkDocument(String rawText) {
        List<RawSection> sections = splitIntoSections(rawText);
        List<PolicyChunk> chunks  = new ArrayList<>();
        for (RawSection sec : sections) {
            chunks.addAll(subSplitIfNeeded(sec.text(), sec.section(), sec.subsection()));
        }
        return chunks;
    }

    // -------------------------------------------------------------------------
    // Section splitting
    // -------------------------------------------------------------------------

    record RawSection(String section, String subsection, String text) {}

    List<RawSection> splitIntoSections(String rawText) {
        // Build a unified list of heading positions from both patterns
        List<HeadingHit> hits = new ArrayList<>();

        Matcher md = MD_HEADING.matcher(rawText);
        while (md.find()) {
            int level = md.group(1).length(); // number of # chars
            hits.add(new HeadingHit(md.start(), md.end(), level, md.group(2).trim()));
        }

        Matcher us = UNDERSCORE_HEADING.matcher(rawText);
        while (us.find()) {
            // Only add if no MD heading already covers this position
            int pos = us.start();
            boolean covered = hits.stream()
                    .anyMatch(h -> Math.abs(h.start - pos) < 5);
            if (!covered) {
                // Legacy underscore headings (Description ___, Eligible lives ___)
                // are subsections. Keep them below ATX benefit headings so the
                // parent benefit name remains attached to every resulting chunk.
                hits.add(new HeadingHit(pos, us.end(), 5, us.group("heading").trim()));
            }
        }

        // Sort by position in document
        hits.sort((a, b) -> Integer.compare(a.start, b.start));

        if (hits.isEmpty()) {
            return splitByParagraphs(rawText);
        }

        List<RawSection> sections = new ArrayList<>();

        // Text before first heading
        if (hits.get(0).start > 0) {
            String pre = rawText.substring(0, hits.get(0).start).trim();
            if (!pre.isEmpty()) {
                sections.add(new RawSection("Preamble", null, pre));
            }
        }

        for (int i = 0; i < hits.size(); i++) {
            HeadingHit current = hits.get(i);
            int bodyStart = current.end;
            int bodyEnd   = (i + 1 < hits.size()) ? hits.get(i + 1).start : rawText.length();
            String body   = rawText.substring(bodyStart, bodyEnd).trim();

            if (body.isEmpty()) continue;

            // Determine section / subsection based on heading level
            String section    = current.level <= 2 ? current.text : deriveParent(hits, i);
            String subsection = current.level >= 3 ? current.text : null;

            sections.add(new RawSection(section, subsection, body));
        }

        return sections.isEmpty() ? splitByParagraphs(rawText) : sections;
    }

    private String deriveParent(List<HeadingHit> hits, int idx) {
        // Walk backwards to find the nearest heading with lower level number
        for (int i = idx - 1; i >= 0; i--) {
            if (hits.get(i).level < hits.get(idx).level) {
                return hits.get(i).text;
            }
        }
        return hits.get(idx).text;
    }

    private List<RawSection> splitByParagraphs(String rawText) {
        List<RawSection> sections = new ArrayList<>();
        String[] paragraphs = rawText.split("\\r?\\n\\s*\\r?\\n");
        int idx = 1;
        for (String para : paragraphs) {
            String t = para.trim();
            if (!t.isEmpty()) {
                sections.add(new RawSection("Section-" + idx++, null, t));
            }
        }
        return sections;
    }

    // -------------------------------------------------------------------------
    // Sub-splitting
    // -------------------------------------------------------------------------

    List<PolicyChunk> subSplitIfNeeded(String text, String section, String subsection) {
        String trimmed = text.trim();
        if (trimmed.isEmpty()) return List.of();

        // Keep table blocks atomic
        if (isTableBlock(trimmed)) {
            return List.of(new PolicyChunk(section, subsection, trimmed, ChunkType.TABLE, null));
        }

        if (trimmed.length() <= MAX_CHUNK_CHARS) {
            return List.of(new PolicyChunk(section, subsection, trimmed));
        }

        // Try to split at paragraph boundaries first
        List<String> splits = splitAtBoundaries(trimmed, MAX_CHUNK_CHARS, OVERLAP_CHARS);
        List<PolicyChunk> chunks = new ArrayList<>();
        for (String split : splits) {
            if (!split.trim().isEmpty()) {
                chunks.add(new PolicyChunk(section, subsection, split.trim()));
            }
        }
        return chunks;
    }

    private List<String> splitAtBoundaries(String text, int maxChars, int overlap) {
        List<String> chunks = new ArrayList<>();
        int start = 0;

        while (start < text.length()) {
            int end = Math.min(start + maxChars, text.length());

            if (end < text.length()) {
                // Try paragraph boundary
                int paraBreak = text.lastIndexOf("\n\n", end);
                if (paraBreak > start + maxChars / 2) {
                    end = paraBreak;
                } else {
                    // Try newline boundary
                    int lineBreak = text.lastIndexOf("\n", end);
                    if (lineBreak > start + maxChars / 2) {
                        end = lineBreak;
                    } else {
                        // Try sentence boundary
                        int sentBreak = text.lastIndexOf(". ", end);
                        if (sentBreak > start + maxChars / 2) {
                            end = sentBreak + 1;
                        }
                    }
                }
            }

            chunks.add(text.substring(start, end).trim());
            // Move forward with overlap
            start = Math.max(start + 1, end - overlap);
        }

        return chunks;
    }

    private boolean isTableBlock(String text) {
        long tableLines = text.lines()
                .filter(l -> TABLE_ROW.matcher(l).matches())
                .count();
        long totalLines = text.lines().count();
        return totalLines > 0 && (double) tableLines / totalLines > 0.5;
    }

    // -------------------------------------------------------------------------
    // Internal record
    // -------------------------------------------------------------------------

    private record HeadingHit(int start, int end, int level, String text) {}

    // -------------------------------------------------------------------------
    // Legacy compat
    // -------------------------------------------------------------------------

    public PolicyChunk chunkTable(String tableText, String section, String subsection) {
        return new PolicyChunk(section, subsection, tableText, ChunkType.TABLE, null);
    }
}
