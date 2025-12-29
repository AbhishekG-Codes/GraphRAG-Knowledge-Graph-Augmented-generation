import { formatGraphPaths } from './hybridRetrieval.js';

/**
 * Construct a graph-aware prompt for LLM
 * @param {string} query - User query
 * @param {Object} retrievalResults - Results from hybrid retrieval
 * @param {Object} options - Prompt options
 * @returns {string} Formatted prompt
 */
export function constructGraphAwarePrompt(query, retrievalResults, options = {}) {
  const {
    includeChunkText = true,
    includeGraphPaths = true,
    includeProvenance = false,
    maxChunks = 3,
    maxGraphPaths = 5,
  } = options;

  const { vectorChunks, graphChunks, graphPaths, allChunks } = retrievalResults;

  // Select top chunks
  const selectedChunks = allChunks.slice(0, maxChunks);

  let prompt = `Answer using ONLY the information below. Be concise.

`;

  // Add graph context
  if (includeGraphPaths && graphPaths.length > 0) {
    prompt += `KNOWLEDGE GRAPH:
`;
    const formattedPaths = formatGraphPaths(graphPaths.slice(0, maxGraphPaths));
    formattedPaths.forEach((path, i) => {
      prompt += `${i + 1}. ${path}\n`;
    });
    prompt += '\n';
  }

  // Add retrieved text chunks
  if (includeChunkText) {
    prompt += `RETRIEVED DOCUMENTS:\n\n`;
    
    selectedChunks.forEach((chunk, index) => {
      const source = chunk.source_title || 'Unknown';
      const page = chunk.page_number ? ` (page ${chunk.page_number})` : '';
      const chunkType = graphChunks.some(gc => gc.chunk_id === chunk.chunk_id)
        ? ' [From Graph]'
        : ' [From Vector Search]';
      
      prompt += `[Document ${index + 1}] ${source}${page}${includeProvenance ? chunkType : ''}\n`;
      prompt += `${chunk.text}\n\n`;
    });
  }

  // Add the actual question
  prompt += `QUESTION:
${query}

ANSWER:`;

  return prompt;
}

/**
 * Create a simplified prompt without graph context
 * @param {string} query - User query
 * @param {Array} chunks - Retrieved chunks
 * @returns {string} Formatted prompt
 */
export function constructSimplePrompt(query, chunks) {
  let prompt = `Answer the following question based on the provided documents.

DOCUMENTS:

`;

  chunks.forEach((chunk, index) => {
    prompt += `[${index + 1}] ${chunk.text}\n\n`;
  });

  prompt += `QUESTION: ${query}

ANSWER:`;

  return prompt;
}

/**
 * Extract citations from chunks
 * @param {Array} chunks - Chunks used in context
 * @returns {Array} Citation objects
 */
export function extractCitations(chunks) {
  const citations = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const key = `${chunk.doc_id}:${chunk.page_number}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        source_title: chunk.source_title,
        page_number: chunk.page_number,
        doc_id: chunk.doc_id,
        chunk_id: chunk.chunk_id,
      });
    }
  }

  return citations;
}

/**
 * Format citations for display
 * @param {Array} citations - Citation objects
 * @returns {string} Formatted citation text
 */
export function formatCitations(citations) {
  if (citations.length === 0) return '';

  let text = '\n\nSOURCES:\n';
  citations.forEach((cite, i) => {
    const page = cite.page_number ? `, page ${cite.page_number}` : '';
    text += `[${i + 1}] ${cite.source_title}${page}\n`;
  });

  return text;
}

/**
 * Create a verification prompt to check answer accuracy
 * @param {string} query - Original query
 * @param {string} answer - Generated answer
 * @param {Array} chunks - Source chunks
 * @returns {string} Verification prompt
 */
export function constructVerificationPrompt(query, answer, chunks) {
  return `Verify if the following answer is supported by the provided documents.

QUESTION: ${query}

ANSWER: ${answer}

DOCUMENTS:
${chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n')}

Is the answer fully supported by the documents? Respond with:
- "VERIFIED" if all claims in the answer are supported
- "PARTIAL" if some claims are supported but others are not
- "UNSUPPORTED" if major claims are not supported

Explanation:`;
}
