import { OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../../config.js';

// How many chunks to embed in one request batch
const EMBED_BATCH_SIZE = 20;

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
 * Generate embedding for a single piece of text (used by hybridRetrieval for query embedding).
 * @param {string} text - Text to embed
 * @param {OllamaEmbeddings} embeddingModel - Embedding model instance
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, embeddingModel) {
  const [embedding] = await embeddingModel.embedDocuments([text]);
  return embedding;
}

/**
 * Generate embeddings for multiple chunks using batched requests.
 * Instead of embedding one chunk at a time, each request contains up to
 * EMBED_BATCH_SIZE chunks.
 *
 * @param {Array} chunks - Array of chunk objects with a `text` field
 * @returns {Promise<Array>} Chunks with `embedding` and `embedding_dimensions` added
 */
export async function generateEmbeddingsForChunks(chunks) {
  console.log(`\n🔢 Generating embeddings for ${chunks.length} chunks (batch size ${EMBED_BATCH_SIZE})...`);

  const embeddingModel = createEmbeddingModel();
  const result = [];
  const total = chunks.length;

  for (let i = 0; i < total; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(c => c.text);

    try {
      // embedDocuments() sends all texts in one request — much faster than embedQuery() in a loop
      const embeddings = await embeddingModel.embedDocuments(texts);

      for (let j = 0; j < batch.length; j++) {
        result.push({
          ...batch[j],
          embedding: embeddings[j],
          embedding_dimensions: embeddings[j].length,
        });
      }
    } catch (error) {
      console.error(`  ⚠️  Batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1} failed: ${error.message} — retrying one-by-one...`);
      // Fallback: embed one-by-one for this batch so we don't lose chunks
      for (const chunk of batch) {
        try {
          const [embedding] = await embeddingModel.embedDocuments([chunk.text]);
          result.push({ ...chunk, embedding, embedding_dimensions: embedding.length });
        } catch (e2) {
          console.error(`  ✗ Skipping chunk ${chunk.chunk_id}: ${e2.message}`);
        }
      }
    }

    const done = Math.min(i + EMBED_BATCH_SIZE, total);
    console.log(`  Progress: ${done}/${total} chunks embedded`);
  }

  console.log(`✅ Generated ${result.length} embeddings\n`);
  return result;
}

/**
 * Generate embeddings for documents (each document has a `chunks` array).
 *
 * @param {Array} documents - Array of document objects with chunks
 * @returns {Promise<Array>} Documents with embedded chunks
 */
export async function embedDocuments(documents) {
  const embeddedDocuments = [];

  for (const doc of documents) {
    console.log(`Embedding document: ${doc.source_title} (${doc.chunks.length} chunks)`);
    const embeddedChunks = await generateEmbeddingsForChunks(doc.chunks);
    embeddedDocuments.push({ ...doc, chunks: embeddedChunks });
  }

  return embeddedDocuments;
}
