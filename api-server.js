/**
 * Simple Express API server for GraphRAG UI
 */

import express from 'express';
import cors from 'cors';
import { queryGraphRAG } from './src/query/queryEngine.js';
import { connectMongoDB, closeMongoDB } from './src/database/mongodbClient.js';
import { connectNeo4j, closeNeo4j } from './src/database/neo4jClient.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Connect to databases on startup
let connected = false;

async function ensureConnected() {
  if (!connected) {
    await connectMongoDB();
    await connectNeo4j();
    connected = true;
  }
}

// Query endpoint
app.post('/api/query', async (req, res) => {
  try {
    await ensureConnected();
    
    const { query, topK = 2, graphDepth = 1 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`\n📥 Received query: "${query}"`);
    console.log(`   Settings: topK=${topK}, graphDepth=${graphDepth}`);
    
    const result = await queryGraphRAG(query, {
      topK,
      graphDepth,
      verbose: true,
    });

    console.log(`✅ Query completed successfully\n`);

    res.json({
      success: true,
      data: {
        query: result.query,
        answer: result.answer,
        citations: result.citations,
        graphPaths: result.graphPaths,
        stats: {
          vectorChunks: result.retrievalResults.vectorChunks.length,
          graphChunks: result.retrievalResults.graphChunks.length,
          totalChunks: result.retrievalResults.allChunks.length,
          graphPathCount: result.graphPaths.length,
        },
      },
    });
  } catch (error) {
    console.error('❌ Query error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', connected });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  if (connected) {
    await closeMongoDB();
    await closeNeo4j();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 GraphRAG API Server running on http://localhost:${PORT}`);
  console.log(`   - Query endpoint: POST http://localhost:${PORT}/api/query`);
  console.log(`   - Health check: GET http://localhost:${PORT}/api/health\n`);
});
