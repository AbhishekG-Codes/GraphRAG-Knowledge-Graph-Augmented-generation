import { ChatOllama } from '@langchain/ollama';
import { config } from '../../config.js';

/**
 * Create Ollama chat model for entity extraction
 */
export function createExtractionModel() {
  return new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0, // Low temperature for consistent extraction
    format: 'json', // Request JSON output
    timeout: 60000, // 60 second timeout for Ollama itself
  });
}

/**
 * Create extraction prompt for entities and relationships
 * @param {string} text - Text chunk to analyze
 * @returns {string} Formatted prompt
 */
export function createExtractionPrompt(text) {
  // Simplified, shorter prompt for faster processing
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
 * Extract entities and relationships from text using Ollama
 * @param {string} text - Text to analyze
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Extracted entities and relationships
 */
export async function extractEntitiesAndRelationships(text, timeout = 45000) {
  const model = createExtractionModel();
  const prompt = createExtractionPrompt(text);

  try {
    // Add timeout protection
    const extractionPromise = model.invoke(prompt);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Extraction timeout')), timeout)
    );
    
    const response = await Promise.race([extractionPromise, timeoutPromise]);
    
    // Parse JSON response
    const content = response.content;
    const extraction = JSON.parse(content);

    // Validate structure
    if (!extraction.entities || !Array.isArray(extraction.entities)) {
      extraction.entities = [];
    }
    if (!extraction.relationships || !Array.isArray(extraction.relationships)) {
      extraction.relationships = [];
    }

    return extraction;
  } catch (error) {
    console.error('Error extracting entities:', error.message);
    // Return empty extraction on error
    return {
      entities: [],
      relationships: [],
      error: error.message,
    };
  }
}

/**
 * Extract entities from multiple chunks in batch
 * @param {Array} chunks - Array of chunk objects with text
 * @returns {Promise<Array>} Chunks with extractions added
 */
export async function extractFromChunks(chunks) {
  console.log(`\n🔍 Extracting entities from ${chunks.length} chunks...`);
  
  const chunksWithExtractions = [];
  let totalEntities = 0;
  let totalRelationships = 0;
  let processed = 0;
  let errors = 0;

  for (const chunk of chunks) {
    try {
      // Progress indicator before processing
      process.stdout.write(`\r  Processing: ${processed + 1}/${chunks.length} chunks...`);
      
      const extraction = await extractEntitiesAndRelationships(chunk.text, 45000); // 45s timeout per chunk
      
      chunksWithExtractions.push({
        ...chunk,
        extraction,
      });

      totalEntities += extraction.entities?.length || 0;
      totalRelationships += extraction.relationships?.length || 0;
      processed++;

      // Detailed progress every chunk
      if (extraction.entities?.length > 0 || extraction.relationships?.length > 0) {
        process.stdout.write(`\r  ✓ ${processed}/${chunks.length} | Entities: ${totalEntities} | Relations: ${totalRelationships} | Errors: ${errors}    \n`);
      }
    } catch (error) {
      errors++;
      process.stdout.write(`\r  ✗ Error at ${processed + 1}/${chunks.length}: ${error.message}    \n`);
      chunksWithExtractions.push({
        ...chunk,
        extraction: { entities: [], relationships: [], error: error.message },
      });
      processed++;
    }
  }

  console.log(`\n✅ Extraction complete: ${totalEntities} entities, ${totalRelationships} relationships (${errors} errors)\n`);

  return chunksWithExtractions;
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

  // Validate entities
  for (const entity of extraction.entities) {
    if (!entity.name || !entity.type) return false;
    if (!['Person', 'Company', 'Product', 'Field'].includes(entity.type)) return false;
  }

  // Validate relationships
  for (const rel of extraction.relationships) {
    if (!rel.from || !rel.to || !rel.type) return false;
    if (!rel.from_type || !rel.to_type) return false;
  }

  return true;
}
