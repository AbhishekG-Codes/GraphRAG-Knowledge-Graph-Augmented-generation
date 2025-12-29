import { MongoClient } from 'mongodb';
import { config } from '../../config.js';

let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas
 * @returns {Promise<MongoClient>}
 */
export async function connectMongoDB() {
  if (client) {
    return client;
  }

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    client = new MongoClient(config.mongodb.uri);
    await client.connect();
    db = client.db(config.mongodb.database);
    console.log('✅ Connected to MongoDB Atlas\n');
    return client;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Get MongoDB database instance
 * @returns {Db}
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not connected. Call connectMongoDB() first.');
  }
  return db;
}

/**
 * Get collection instance
 * @param {string} collectionName - Optional collection name
 * @returns {Collection}
 */
export function getCollection(collectionName = null) {
  const name = collectionName || config.mongodb.collection;
  return getDatabase().collection(name);
}

/**
 * Close MongoDB connection
 */
export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Insert chunks into MongoDB with embeddings
 * @param {Array} chunks - Array of chunks with embeddings
 * @returns {Promise<Object>} Insert result
 */
export async function insertChunks(chunks) {
  try {
    const collection = getCollection();
    
    console.log(`\n💾 Inserting ${chunks.length} chunks into MongoDB...`);
    
    const result = await collection.insertMany(chunks);
    
    console.log(`✅ Inserted ${result.insertedCount} chunks\n`);
    
    return result;
  } catch (error) {
    console.error('Error inserting chunks:', error);
    throw error;
  }
}

/**
 * Create Atlas Vector Search index
 * Note: This needs to be done via Atlas UI or Atlas CLI
 * This function provides the JSON definition to use
 */
export function getVectorSearchIndexDefinition() {
  return {
    name: 'vector_index',
    type: 'vectorSearch',
    definition: {
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: config.vectorSearch.dimensions,
          similarity: 'cosine',
        },
        {
          type: 'filter',
          path: 'doc_id',
        },
        {
          type: 'filter',
          path: 'source_title',
        },
      ],
    },
  };
}

/**
 * Perform vector search in MongoDB Atlas
 * @param {Array<number>} queryEmbedding - Query embedding vector
 * @param {number} limit - Number of results to return
 * @param {Object} filter - Optional filter criteria
 * @returns {Promise<Array>} Search results
 */
export async function vectorSearch(queryEmbedding, limit = null, filter = {}) {
  const collection = getCollection();
  const k = limit || config.vectorSearch.topK;

  const pipeline = [
    {
      $vectorSearch: {
        index: 'langgraph_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: k * 10,
        limit: k,
        filter: filter,
      },
    },
    {
      $project: {
        _id: 0,
        chunk_id: 1,
        doc_id: 1,
        source_title: 1,
        text: 1,
        page_number: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();
  return results;
}

/**
 * Find chunks by document ID
 * @param {string} docId - Document ID
 * @returns {Promise<Array>} Chunks
 */
export async function getChunksByDocId(docId) {
  const collection = getCollection();
  return await collection.find({ doc_id: docId }).toArray();
}

/**
 * Find chunks by chunk IDs
 * @param {Array<string>} chunkIds - Array of chunk IDs
 * @returns {Promise<Array>} Chunks
 */
export async function getChunksByIds(chunkIds) {
  const collection = getCollection();
  return await collection.find({ chunk_id: { $in: chunkIds } }).toArray();
}

/**
 * Delete all chunks for a document
 * @param {string} docId - Document ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteDocumentChunks(docId) {
  const collection = getCollection();
  return await collection.deleteMany({ doc_id: docId });
}

/**
 * Get collection statistics
 * @returns {Promise<Object>} Collection stats
 */
export async function getCollectionStats() {
  const collection = getCollection();
  const count = await collection.countDocuments();
  const uniqueDocs = await collection.distinct('doc_id');
  
  return {
    total_chunks: count,
    unique_documents: uniqueDocs.length,
    documents: uniqueDocs,
  };
}
