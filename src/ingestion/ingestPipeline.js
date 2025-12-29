import { processPDFBatch } from '../utils/pdfProcessor.js';
import { embedDocuments } from '../utils/embeddingGenerator.js';
import { connectMongoDB, insertChunks, closeMongoDB, getCollectionStats } from '../database/mongodbClient.js';

/**
 * Main ingestion pipeline - Process PDFs and store in MongoDB
 * @param {Array<string>} pdfPaths - Array of PDF file paths
 * @returns {Promise<Object>} Ingestion results
 */
export async function ingestPDFs(pdfPaths) {
  console.log('🚀 Starting PDF Ingestion Pipeline\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Connect to MongoDB
    await connectMongoDB();
    
    // Step 2: Process PDFs - Extract text and chunk
    const documents = await processPDFBatch(pdfPaths);
    
    if (documents.length === 0) {
      console.log('⚠️  No documents processed successfully');
      return { success: false, documents: [] };
    }
    
    // Step 3: Generate embeddings for all chunks
    const embeddedDocuments = await embedDocuments(documents);
    
    // Step 4: Flatten chunks from all documents
    const allChunks = embeddedDocuments.flatMap(doc => doc.chunks);
    
    // Step 5: Insert chunks into MongoDB
    await insertChunks(allChunks);
    
    // Step 6: Get final statistics
    const stats = await getCollectionStats();
    
    console.log('=' .repeat(60));
    console.log('📊 Ingestion Complete!\n');
    console.log('Statistics:');
    console.log(`  Documents Processed: ${embeddedDocuments.length}`);
    console.log(`  Total Chunks: ${allChunks.length}`);
    console.log(`  Stored in MongoDB: ${stats.total_chunks} chunks across ${stats.unique_documents} documents`);
    console.log('=' .repeat(60));
    
    return {
      success: true,
      documents: embeddedDocuments,
      stats,
    };
    
  } catch (error) {
    console.error('❌ Ingestion pipeline failed:', error);
    throw error;
  } finally {
    await closeMongoDB();
  }
}

/**
 * Ingest single PDF file
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Object>} Ingestion result
 */
export async function ingestSinglePDF(pdfPath) {
  return await ingestPDFs([pdfPath]);
}
