import { connectMongoDB, getCollection, closeMongoDB } from '../database/mongodbClient.js';
import { connectNeo4j, storeExtraction, closeNeo4j, getGraphStats } from '../database/neo4jClient.js';
import { extractFromChunks } from '../extraction/entityExtractor.js';

/**
 * Main extraction pipeline - Extract entities from MongoDB chunks and store in Neo4j
 * @param {Object} options - Pipeline options
 * @returns {Promise<Object>} Extraction results
 */
export async function extractEntitiesFromChunks(options = {}) {
  const {
    limit = null,
    docId = null,
    batchSize = 10, // Process in smaller batches to avoid rate limits
  } = options;

  console.log('🚀 Starting Entity Extraction Pipeline\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Connect to databases
    await connectMongoDB();
    await connectNeo4j();

    // Step 2: Retrieve chunks from MongoDB
    console.log('📚 Retrieving chunks from MongoDB...');
    const collection = getCollection();
    
    const query = docId ? { doc_id: docId } : {};
    const chunks = await collection
      .find(query)
      .limit(limit || 0)
      .toArray();

    if (chunks.length === 0) {
      console.log('⚠️  No chunks found in MongoDB');
      return { success: false, stats: null };
    }

    console.log(`✅ Retrieved ${chunks.length} chunks\n`);

    // Step 3: Process chunks in batches
    console.log(`Processing in batches of ${batchSize}...`);
    let totalEntities = 0;
    let totalRelationships = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

      // Extract entities and relationships
      const extractedChunks = await extractFromChunks(batch);

      // Store in Neo4j
      console.log('💾 Storing in Neo4j...');
      for (const chunk of extractedChunks) {
        if (chunk.extraction && (chunk.extraction.entities?.length > 0 || chunk.extraction.relationships?.length > 0)) {
          const result = await storeExtraction(
            chunk.extraction,
            chunk.chunk_id,
            chunk.doc_id
          );
          totalEntities += result.entities;
          totalRelationships += result.relationships;
        }
      }
      console.log(`✅ Batch ${batchNum} stored`);
    }

    // Step 4: Get final statistics
    const graphStats = await getGraphStats();

    console.log('\n' + '=' .repeat(60));
    console.log('📊 Extraction Complete!\n');
    console.log('Statistics:');
    console.log(`  Chunks Processed: ${chunks.length}`);
    console.log(`  Entities Extracted: ${totalEntities}`);
    console.log(`  Relationships Extracted: ${totalRelationships}`);
    console.log(`  Graph Nodes: ${graphStats.nodes}`);
    console.log(`  Graph Relationships: ${graphStats.relationships}`);
    console.log('=' .repeat(60));

    return {
      success: true,
      stats: {
        chunks_processed: chunks.length,
        entities_extracted: totalEntities,
        relationships_extracted: totalRelationships,
        graph_nodes: graphStats.nodes,
        graph_relationships: graphStats.relationships,
      },
    };

  } catch (error) {
    console.error('❌ Extraction pipeline failed:', error);
    throw error;
  } finally {
    await closeMongoDB();
    await closeNeo4j();
  }
}

/**
 * Extract entities from specific document
 * @param {string} docId - Document ID
 * @returns {Promise<Object>} Extraction result
 */
export async function extractFromDocument(docId) {
  return await extractEntitiesFromChunks({ docId });
}

/**
 * Extract entities from limited number of chunks (for testing)
 * @param {number} limit - Maximum chunks to process
 * @returns {Promise<Object>} Extraction result
 */
export async function extractFromSample(limit = 10) {
  return await extractEntitiesFromChunks({ limit, batchSize: 5 });
}
