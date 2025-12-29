import fs from 'fs/promises';
import { PDFExtract } from 'pdf.js-extract';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config.js';

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<{text: string, pages: number}>}
 */
export async function extractTextFromPDF(filePath) {
  try {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(filePath, {});
    
    // Combine text from all pages
    const text = data.pages
      .map(page => page.content.map(item => item.str).join(' '))
      .join('\n\n');
    
    return {
      text,
      pages: data.pages.length,
      info: {
        numPages: data.pages.length,
      },
    };
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error);
    throw error;
  }
}

/**
 * Chunk document text into smaller segments
 * @param {string} text - Document text
 * @param {string} docId - Document identifier
 * @param {string} sourceTitle - Source document title
 * @param {number} totalPages - Total pages in document
 * @returns {Promise<Array>} Array of chunks with metadata
 */
export async function chunkDocument(text, docId, sourceTitle, totalPages = 1) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.vectorSearch.chunkSize,
    chunkOverlap: config.vectorSearch.chunkOverlap,
  });

  const docs = await splitter.createDocuments([text]);
  
  // Add metadata to each chunk
  const chunks = docs.map((doc, index) => {
    const chunkId = uuidv4();
    
    // Estimate page number based on chunk position
    const estimatedPage = Math.floor((index / docs.length) * totalPages) + 1;
    
    return {
      chunk_id: chunkId,
      doc_id: docId,
      source_title: sourceTitle,
      page_number: estimatedPage,
      text: doc.pageContent,
      chunk_index: index,
      total_chunks: docs.length,
      metadata: {
        created_at: new Date().toISOString(),
        char_count: doc.pageContent.length,
      },
    };
  });

  return chunks;
}

/**
 * Process single PDF file - extract text and chunk it
 * @param {string} filePath - Path to PDF file
 * @param {string} docId - Optional document ID (generates UUID if not provided)
 * @returns {Promise<{docId: string, sourceTitle: string, chunks: Array}>}
 */
export async function processPDF(filePath, docId = null) {
  const fileName = filePath.split('/').pop();
  const sourceTitle = fileName.replace('.pdf', '');
  const documentId = docId || uuidv4();

  console.log(`Processing PDF: ${sourceTitle}`);

  // Extract text from PDF
  const { text, pages } = await extractTextFromPDF(filePath);
  console.log(`  Extracted ${text.length} characters from ${pages} pages`);

  // Chunk the document
  const chunks = await chunkDocument(text, documentId, sourceTitle, pages);
  console.log(`  Created ${chunks.length} chunks`);

  return {
    doc_id: documentId,
    source_title: sourceTitle,
    total_pages: pages,
    chunks,
  };
}

/**
 * Process multiple PDF files
 * @param {Array<string>} filePaths - Array of PDF file paths
 * @returns {Promise<Array>} Array of processed documents with chunks
 */
export async function processPDFBatch(filePaths) {
  console.log(`\n📚 Processing ${filePaths.length} PDF files...\n`);
  
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const result = await processPDF(filePath);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error.message);
    }
  }
  
  const totalChunks = results.reduce((sum, doc) => sum + doc.chunks.length, 0);
  console.log(`\n✅ Processed ${results.length} documents, ${totalChunks} total chunks\n`);
  
  return results;
}
