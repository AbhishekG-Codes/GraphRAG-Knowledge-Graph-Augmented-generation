/**
 * MongoDB Atlas Vector Search Index Setup Guide
 * 
 * This script provides the JSON definition you need to create
 * the vector search index in MongoDB Atlas.
 * 
 * NOTE: Vector Search indexes must be created via:
 * 1. MongoDB Atlas UI (Database > Search Indexes)
 * 2. Atlas CLI
 * 3. MongoDB Atlas Admin API
 * 
 * Run this script to get the index definition:
 *   node setup-vector-index.js
 */

import { getVectorSearchIndexDefinition } from './src/database/mongodbClient.js';
import { config } from './config.js';

console.log('\n📋 MongoDB Atlas Vector Search Index Configuration\n');
console.log('=' .repeat(70));
console.log('\n🎯 Target Configuration:\n');
console.log(`  Database: ${config.mongodb.database}`);
console.log(`  Collection: ${config.mongodb.collection}`);
console.log(`  Index Name: vector_index`);
console.log(`  Vector Dimensions: ${config.vectorSearch.dimensions}`);
console.log(`  Similarity: cosine`);

console.log('\n' + '=' .repeat(70));
console.log('\n📝 Index Definition (JSON):\n');

const indexDef = getVectorSearchIndexDefinition();
console.log(JSON.stringify(indexDef, null, 2));

console.log('\n' + '=' .repeat(70));
console.log('\n📚 Setup Instructions:\n');
console.log('1. Go to MongoDB Atlas: https://cloud.mongodb.com');
console.log('2. Navigate to: Database > Browse Collections');
console.log(`3. Select database: ${config.mongodb.database}`);
console.log(`4. Select collection: ${config.mongodb.collection}`);
console.log('5. Click "Search Indexes" tab');
console.log('6. Click "Create Search Index"');
console.log('7. Choose "JSON Editor"');
console.log('8. Paste the JSON definition above');
console.log('9. Click "Create Search Index"');
console.log('\n⏱️  Index creation takes 1-2 minutes\n');

console.log('=' .repeat(70));
console.log('\n✅ After index is created, you can:');
console.log('  - Ingest PDFs: node ingest-pdfs.js ./data/*.pdf');
console.log('  - Test vector search');
console.log('  - Proceed to Step 3 (Entity Extraction)\n');

console.log('=' .repeat(70));
console.log('\n💡 Verification:\n');
console.log('Check index status in Atlas UI:');
console.log('  Status should show "Active" (not "Building" or "Failed")\n');

console.log('=' .repeat(70));
console.log('\n🔧 Alternative: Atlas CLI Method\n');
console.log('If you have Atlas CLI installed:\n');
console.log('atlas clusters search indexes create \\');
console.log(`  --clusterName <your-cluster-name> \\`);
console.log('  --file vector-index.json\n');
console.log('(Save the JSON above to vector-index.json first)\n');

console.log('=' .repeat(70) + '\n');
