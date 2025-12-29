import { ChatOllama } from '@langchain/ollama';
import { config } from '../../config.js';
import { connectMongoDB, closeMongoDB } from '../database/mongodbClient.js';
import { connectNeo4j, closeNeo4j } from '../database/neo4jClient.js';
import { hybridRetrieval } from '../retrieval/hybridRetrieval.js';
import { constructGraphAwarePrompt, extractCitations, formatCitations } from '../retrieval/promptBuilder.js';

/**
 * Create Ollama model for answer generation
 */
function createAnswerModel() {
  return new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.3,
    timeout: 180000, // 180 second timeout
    numPredict: 300, // Shorter responses
  });
}

/**
 * Generate answer using GraphRAG pipeline
 * @param {string} query - User question
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Answer with provenance
 */
export async function queryGraphRAG(query, options = {}) {
  const {
    topK = config.vectorSearch.topK,
    graphDepth = config.vectorSearch.graphTraversalDepth,
    verbose = true,
  } = options;

  if (verbose) {
    console.log('\n🤖 GraphRAG Query Pipeline\n');
    console.log('=' .repeat(60));
    console.log(`Query: "${query}"\n`);
  }

  try {
    // Step 1: Connect to databases
    if (verbose) console.log('🔌 Connecting to databases...');
    await connectMongoDB();
    await connectNeo4j();
    if (verbose) console.log('✅ Connected\n');

    // Step 2: Hybrid retrieval
    const retrievalResults = await hybridRetrieval(query, { topK, graphDepth });

    if (retrievalResults.allChunks.length === 0) {
      return {
        query,
        answer: 'I could not find relevant information to answer your question.',
        citations: [],
        graphPaths: [],
        retrievalResults,
      };
    }

    // Step 3: Construct graph-aware prompt
    if (verbose) console.log('\n6️⃣  Constructing graph-aware prompt...');
    const prompt = constructGraphAwarePrompt(query, retrievalResults, {
      maxChunks: 2, // Ultra minimal to prevent timeout
      maxGraphPaths: 3, // Very few graph paths
      includeGraphPaths: graphDepth > 0,
      includeProvenance: false,
    });
    if (verbose) console.log(`   ✅ Prompt constructed (${prompt.length} chars)`);

    // Step 4: Generate answer with Ollama
    if (verbose) console.log('\n7️⃣  Generating answer with Ollama...');
    let answer;
    try {
      const model = createAnswerModel();
      const response = await model.invoke(prompt);
      answer = response.content;
      if (verbose) console.log('   ✅ Answer generated');
    } catch (error) {
      console.error('   ⚠️  Ollama timeout, using fallback response');
      answer = 'Unable to generate answer due to timeout. Try reducing graph depth or asking a simpler question.';
    }

    // Step 5: Extract citations
    const citations = extractCitations(retrievalResults.allChunks);

    if (verbose) {
      console.log('\n' + '=' .repeat(60));
      console.log('📊 Query Complete!\n');
      console.log(`Retrieved: ${retrievalResults.vectorChunks.length} vector chunks, ${retrievalResults.graphChunks.length} graph chunks`);
      console.log(`Graph paths: ${retrievalResults.graphPaths.length}`);
      console.log(`Citations: ${citations.length}`);
      console.log('=' .repeat(60));
    }

    return {
      query,
      answer,
      citations,
      graphPaths: retrievalResults.graphPaths,
      retrievalResults,
    };

  } catch (error) {
    console.error('❌ GraphRAG query failed:', error);
    throw error;
  } finally {
    await closeMongoDB();
    await closeNeo4j();
  }
}

/**
 * Format query result for display
 * @param {Object} result - Query result
 * @returns {string} Formatted text
 */
export function formatQueryResult(result) {
  let output = '\n' + '=' .repeat(60) + '\n';
  output += `QUESTION: ${result.query}\n\n`;
  output += `ANSWER:\n${result.answer}\n`;

  if (result.graphPaths && result.graphPaths.length > 0) {
    output += '\n' + '-' .repeat(60) + '\n';
    output += 'KNOWLEDGE GRAPH CONNECTIONS:\n';
    result.graphPaths.slice(0, 5).forEach((path, i) => {
      output += `  ${i + 1}. ${path.from} → ${path.to}\n`;
    });
    if (result.graphPaths.length > 5) {
      output += `  ... and ${result.graphPaths.length - 5} more connections\n`;
    }
  }

  if (result.citations && result.citations.length > 0) {
    output += formatCitations(result.citations);
  }

  output += '\n' + '=' .repeat(60) + '\n';

  return output;
}

/**
 * Query with simple vector search only (no graph)
 * @param {string} query - User question
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Answer result
 */
export async function queryVectorOnly(query, options = {}) {
  // Similar to queryGraphRAG but skips graph expansion
  // Useful for comparison
  return await queryGraphRAG(query, { ...options, graphDepth: 0 });
}
