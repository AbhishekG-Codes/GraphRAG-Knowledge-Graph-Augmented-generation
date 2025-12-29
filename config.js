import 'dotenv/config';

export const config = {
  // Ollama Configuration
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  },

  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI,
    database: process.env.MONGODB_DATABASE || 'graphrag',
    collection: process.env.MONGODB_COLLECTION || 'document_chunks',
  },

  // Neo4j Configuration
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD,
  },

  // Vector Search Configuration
  vectorSearch: {
    dimensions: parseInt(process.env.VECTOR_DIMENSIONS) || 768,
    chunkSize: parseInt(process.env.CHUNK_SIZE) || 500,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50,
    topK: parseInt(process.env.TOP_K_RESULTS) || 5,
    graphTraversalDepth: parseInt(process.env.GRAPH_TRAVERSAL_DEPTH) || 2,
  },
};

// Validate required configuration
export function validateConfig() {
  const errors = [];

  if (!config.mongodb.uri) {
    errors.push('MONGODB_URI is required');
  }

  if (!config.neo4j.password) {
    errors.push('NEO4J_PASSWORD is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
