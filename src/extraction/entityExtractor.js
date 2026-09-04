import { ChatOllama } from '@langchain/ollama';
import { config } from '../../config.js';

// How many chunks to process in parallel during entity extraction
const EXTRACTION_CONCURRENCY = 4;

/**
 * Create Ollama chat model for entity extraction
 */
export function createExtractionModel() {
  return new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0,  // Low temperature for consistent extraction
    format: 'json',  // Request JSON output
    timeout: 60000,  // 60 second timeout
  });
}

/**
 * Create extraction prompt for entities and relationships
 * @param {string} text - Text chunk to analyze
 * @returns {string} Formatted prompt
 */
export function createExtractionPrompt(text) {
  return `Extract entities and relationships from this text as JSON.

Entity types: Person, Company, Product, Field
Relationship types: CEO_OF, FOUNDED, WORKS_ON, INVESTED_IN, PARTNERED_WITH, DEVELOPED, RELATED_TO

TEXT:
${text.substring(0, 800)}

Return JSON:
{"entities":[{"name":"string","type":"Person|Company|Product|Field"}],"relationships":[{"from":"name","from_type":"type","type":"rel_type","to":"name","to_type":"type"}]}

JSON:`;
}

/**
 * Extract entities and relationships from a single text chunk using Ollama.
 * @param {string} text - Text to analyze
 * @param {number} timeout - Per-chunk timeout in ms
 * @returns {Promise<Object>} Extracted entities and relationships
 */
export async function extractEntitiesAndRelationships(text, timeout = 45000) {
  const model = createExtractionModel();
  const prompt = createExtractionPrompt(text);
  const controller = new AbortController();
  let timeoutId;

  try {
    const extractionPromise = model.invoke(prompt, { signal: controller.signal });
    const timeoutPromise = new Promise((_, reject) =>
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Extraction timeout'));
      }, timeout)
    );

    const response = await Promise.race([extractionPromise, timeoutPromise]);
    const content = response.content;
    const extraction = JSON.parse(content);

    if (!extraction.entities || !Array.isArray(extraction.entities)) {
      extraction.entities = [];
    }
    if (!extraction.relationships || !Array.isArray(extraction.relationships)) {
      extraction.relationships = [];
    }

    return extraction;
  } catch (error) {
    // Return empty extraction on error so the pipeline continues
    return {
      entities: [],
      relationships: [],
      error: error.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract entities from multiple chunks using controlled parallelism.
 * Runs EXTRACTION_CONCURRENCY chunks at a time instead of one-by-one,
 * which gives a significant speedup on multi-core machines.
 *
 * @param {Array} chunks - Array of chunk objects with a `text` field
 * @returns {Promise<Array>} Chunks with `extraction` field added
 */
export async function extractFromChunks(chunks) {
  console.log(`\n🔍 Extracting entities from ${chunks.length} chunks (concurrency ${EXTRACTION_CONCURRENCY})...`);

  const total = chunks.length;
  let processed = 0;
  let totalEntities = 0;
  let totalRelationships = 0;
  let errors = 0;

  const results = new Array(total);

  // Process chunks in parallel windows of EXTRACTION_CONCURRENCY
  for (let i = 0; i < total; i += EXTRACTION_CONCURRENCY) {
    const window = chunks.slice(i, i + EXTRACTION_CONCURRENCY);

    const settled = await Promise.allSettled(
      window.map(chunk => extractEntitiesAndRelationships(chunk.text, 45000))
    );

    for (let j = 0; j < window.length; j++) {
      const chunk = window[j];
      const outcome = settled[j];
      processed++;

      if (outcome.status === 'fulfilled') {
        const extraction = outcome.value;
        results[i + j] = { ...chunk, extraction };
        totalEntities += extraction.entities?.length ?? 0;
        totalRelationships += extraction.relationships?.length ?? 0;
        if (extraction.error) errors++;
      } else {
        errors++;
        results[i + j] = {
          ...chunk,
          extraction: { entities: [], relationships: [], error: outcome.reason?.message },
        };
      }
    }

    process.stdout.write(
      `\r  ✓ ${processed}/${total} | Entities: ${totalEntities} | Relations: ${totalRelationships} | Errors: ${errors}    `
    );
  }

  console.log(`\n✅ Extraction complete: ${totalEntities} entities, ${totalRelationships} relationships (${errors} errors)\n`);
  return results;
}

/**
 * Validate extraction format
 * @param {Object} extraction - Extraction object to validate
 * @returns {boolean} True if valid
 */
export function validateExtraction(extraction) {
  if (!extraction || typeof extraction !== 'object') return false;
  if (!Array.isArray(extraction.entities)) return false;
  if (!Array.isArray(extraction.relationships)) return false;

  for (const entity of extraction.entities) {
    if (!entity.name || !entity.type) return false;
    if (!['Person', 'Company', 'Product', 'Field'].includes(entity.type)) return false;
  }

  for (const rel of extraction.relationships) {
    if (!rel.from || !rel.to || !rel.type) return false;
    if (!rel.from_type || !rel.to_type) return false;
  }

  return true;
}
