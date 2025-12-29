/**
 * PDF Ingestion Script
 * 
 * Usage:
 *   node ingest-pdfs.js <pdf1.pdf> <pdf2.pdf> ...
 * 
 * Or modify the SAMPLE_PDFS array below for testing
 */

import { ingestPDFs } from './src/ingestion/ingestPipeline.js';
import { existsSync } from 'fs';
import path from 'path';

// Sample PDF paths - UPDATE THESE with your actual PDF files
const SAMPLE_PDFS = [
    'data/Artificial_intelligence.pdf',
    'data/Microsoft.pdf',
    'data/OpenAI.pdf',
    'data/Sam_Altman.pdf'
];

async function main() {
  // Get PDF paths from command line arguments or use sample paths
  let pdfPaths = process.argv.slice(2);
  
  if (pdfPaths.length === 0) {
    console.log('ℹ️  No PDF paths provided, using sample paths from script\n');
    pdfPaths = SAMPLE_PDFS;
  }
  
  // Validate that files exist
  const validPaths = [];
  const invalidPaths = [];
  
  for (const pdfPath of pdfPaths) {
    const absolutePath = path.resolve(pdfPath);
    if (existsSync(absolutePath)) {
      validPaths.push(absolutePath);
    } else {
      invalidPaths.push(pdfPath);
    }
  }
  
  if (invalidPaths.length > 0) {
    console.log('⚠️  Warning: Following files not found:');
    invalidPaths.forEach(p => console.log(`    - ${p}`));
    console.log('');
  }
  
  if (validPaths.length === 0) {
    console.error('❌ No valid PDF files found.');
    console.log('\nUsage:');
    console.log('  node ingest-pdfs.js <pdf1.pdf> <pdf2.pdf> ...');
    console.log('\nOr create a ./data directory with sample PDFs:');
    console.log('  mkdir -p data');
    console.log('  # Add your PDF files to the data/ directory');
    process.exit(1);
  }
  
  console.log(`📂 Found ${validPaths.length} valid PDF file(s):\n`);
  validPaths.forEach((p, i) => console.log(`  ${i + 1}. ${path.basename(p)}`));
  console.log('');
  
  // Run ingestion pipeline
  try {
    const result = await ingestPDFs(validPaths);
    
    if (result.success) {
      console.log('\n✅ SUCCESS! PDFs ingested and ready for GraphRAG queries\n');
      
      console.log('📝 Next Steps:');
      console.log('  1. Verify MongoDB Atlas Vector Search index is created');
      console.log('  2. Run entity extraction: node extract-entities.js');
      console.log('  3. Test vector search queries\n');
    } else {
      console.log('\n⚠️  Ingestion completed with issues\n');
    }
  } catch (error) {
    console.error('\n❌ Ingestion failed:', error.message);
    process.exit(1);
  }
}

main();
