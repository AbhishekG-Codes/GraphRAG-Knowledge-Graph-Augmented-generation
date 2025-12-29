/**
 * Entity Extraction Script
 * 
 * Extracts entities and relationships from ingested chunks
 * and stores them in Neo4j knowledge graph.
 * 
 * Usage:
 *   node extract-entities.js [options]
 * 
 * Options:
 *   --all           Extract from all chunks
 *   --sample=N      Extract from N chunks (default: 20 for testing)
 *   --doc=DOC_ID    Extract from specific document
 *   --batch=N       Batch size (default: 10)
 */

import { extractEntitiesFromChunks, extractFromSample, extractFromDocument } from './src/extraction/extractionPipeline.js';

async function main() {
  const args = process.argv.slice(2);
  
  let options = {
    limit: null,
    docId: null,
    batchSize: 10,
  };

  // Parse arguments
  for (const arg of args) {
    if (arg === '--all') {
      options.limit = null;
    } else if (arg.startsWith('--sample=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--doc=')) {
      options.docId = arg.split('=')[1];
    } else if (arg.startsWith('--batch=')) {
      options.batchSize = parseInt(arg.split('=')[1]);
    }
  }

  console.log('🔍 Entity & Relationship Extraction\n');
  
  if (options.limit === null && !options.docId) {
    console.log('ℹ️  Running in SAMPLE mode (10 chunks)');
    console.log('   Use --all to process all chunks');
    console.log('   Use --sample=N to process N chunks');
    console.log('   Use --doc=DOC_ID to process specific document\n');
    
    // Default: sample mode for safety (reduced from 20 to 10)
    try {
      const result = await extractFromSample(10);
      if (result.success) {
        console.log('\n✅ SUCCESS! Sample extraction complete\n');
        console.log('📝 Next Steps:');
        console.log('  1. Verify entities in Neo4j Browser: http://localhost:7474');
        console.log('  2. Run full extraction: node extract-entities.js --all');
        console.log('  3. Proceed to Step 4: Hybrid Retrieval\n');
      }
    } catch (error) {
      console.error('\n❌ Extraction failed:', error.message);
      process.exit(1);
    }
  } else {
    // Full or filtered extraction
    if (options.docId) {
      console.log(`📄 Extracting from document: ${options.docId}\n`);
    } else if (options.limit) {
      console.log(`📊 Extracting from ${options.limit} chunks\n`);
    } else {
      console.log('📚 Extracting from ALL chunks\n');
    }

    try {
      const result = await extractEntitiesFromChunks(options);
      
      if (result.success) {
        console.log('\n✅ SUCCESS! Entity extraction complete\n');
        console.log('📝 Next Steps:');
        console.log('  1. Verify knowledge graph in Neo4j Browser');
        console.log('  2. Test graph queries');
        console.log('  3. Proceed to Step 4: Hybrid Retrieval\n');
      }
    } catch (error) {
      console.error('\n❌ Extraction failed:', error.message);
      process.exit(1);
    }
  }
}

main();
