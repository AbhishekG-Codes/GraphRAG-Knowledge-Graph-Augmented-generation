import { OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../../config.js';

/**
 * Initialize Ollama embeddings model
 */
export function createEmbeddingModel() {
  return new OllamaEmbeddings({
    model: config.ollama.embeddingModel,
    baseUrl: config.ollama.baseUrl,
  });
}

/**
 * Generate embedding for a single text chunk
 * @param {string} text - Text to embed
 * @param {OllamaEmbeddings} embeddingModel - Embedding model instance
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generateEmbedding(text, embeddingModel) {
  try {
    const embedding = await embeddingModel.embedQuery(text);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple chunks in batch
 * @param {Array} chunks - Array of chunk objects with text
 * @returns {Promise<Array>} Chunks with embeddings added
 */
export async function generateEmbeddingsForChunks(chunks) {
  console.log(`\n🔢 Generating embeddings for ${chunks.length} chunks...`);
  
  const embeddingModel = createEmbeddingModel();
  const chunksWithEmbeddings = [];
  
  let processed = 0;
  
  for (const chunk of chunks) {
    try {
      const embedding = await generateEmbedding(chunk.text, embeddingModel);
      
      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
        embedding_dimensions: embedding.length,
      });
      
      processed++;
      
      // Progress indicator
      if (processed % 10 === 0 || processed === chunks.length) {
        console.log(`  Progress: ${processed}/${chunks.length} chunks embedded`);
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.chunk_id}:`, error.message);
    }
  }
  
  console.log(`✅ Generated ${chunksWithEmbeddings.length} embeddings\n`);
  
  return chunksWithEmbeddings;
}

/**
 * Generate embeddings for documents with chunks
 * @param {Array} documents - Array of document objects with chunks
 * @returns {Promise<Array>} Documents with embedded chunks
 */
export async function embedDocuments(documents) {
  const embeddedDocuments = [];
  
  for (const doc of documents) {
    console.log(`Embedding document: ${doc.source_title}`);
    
    const embeddedChunks = await generateEmbeddingsForChunks(doc.chunks);
    
    embeddedDocuments.push({
      ...doc,
      chunks: embeddedChunks,
    });
  }
  
  return embeddedDocuments;
}
