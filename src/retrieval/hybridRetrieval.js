import { generateEmbedding, createEmbeddingModel } from '../utils/embeddingGenerator.js';
import { vectorSearch } from '../database/mongodbClient.js';
import { findEntitiesByName, findRelatedEntities } from '../database/neo4jClient.js';
import { getChunksByIds } from '../database/mongodbClient.js';
import { config } from '../../config.js';

/**
 * Extract entity names from text chunks by looking them up in Neo4j
 * Uses fuzzy text matching to find entities mentioned in chunks
 * @param {Array} chunks - Array of chunk objects
 * @returns {Promise<Array<string>>} List of entity names found in graph
 */
export async function extractEntityNamesFromChunks(chunks) {
  const entityNames = new Set();
  
  // Method 1: If chunk has extraction metadata, use it
  for (const chunk of chunks) {
    if (chunk.extraction?.entities) {
      for (const entity of chunk.extraction.entities) {
        entityNames.add(entity.name);
      }
    }
  }
  
  // Method 2: Search for known entities in the chunk text
  if (entityNames.size === 0 && chunks.length > 0) {
    try {
      const { getSession } = await import('../database/neo4jClient.js');
      const session = getSession();
      
      // Get all entity names from the graph
      const result = await session.run(`
        MATCH (n)
        WHERE n.name IS NOT NULL
        RETURN DISTINCT n.name as name
      `);
      
      const allEntityNames = result.records.map(r => r.get('name'));
      
      // Check which entities appear in the chunk texts
      for (const chunk of chunks) {
        const chunkText = chunk.text.toLowerCase();
        for (const entityName of allEntityNames) {
          if (chunkText.includes(entityName.toLowerCase())) {
            entityNames.add(entityName);
          }
        }
      }
      
      await session.close();
    } catch (error) {
      console.log(`   ⚠️  Could not search entities in graph: ${error.message}`);
    }
  }
  
  return Array.from(entityNames);
}

/**
 * Perform hybrid retrieval: Vector search + Graph expansion
 * @param {string} query - User query
 * @param {Object} options - Retrieval options
 * @returns {Promise<Object>} Hybrid retrieval results
 */
export async function hybridRetrieval(query, options = {}) {
  const {
    topK = config.vectorSearch.topK,
    graphDepth = config.vectorSearch.graphTraversalDepth,
    includeGraphPaths = true,
  } = options;

  console.log(`\n🔍 Hybrid Retrieval for: "${query}"\n`);

  // Step 1: Generate query embedding
  console.log('1️⃣  Generating query embedding...');
  const embeddingModel = createEmbeddingModel();
  const queryEmbedding = await generateEmbedding(query, embeddingModel);
  console.log(`   ✅ Query embedded (${queryEmbedding.length} dimensions)`);

  // Step 2: Vector search in MongoDB
  console.log(`\n2️⃣  Performing vector search (top ${topK})...`);
  const vectorResults = await vectorSearch(queryEmbedding, topK);
  console.log(`   ✅ Found ${vectorResults.length} relevant chunks`);
  
  if (vectorResults.length === 0) {
    return {
      query,
      vectorChunks: [],
      graphEntities: [],
      graphChunks: [],
      allChunks: [],
      graphPaths: [],
    };
  }

  // Step 3: Extract entities from vector results
  console.log(`\n3️⃣  Extracting entities from chunks...`);
  const entityNames = await extractEntityNamesFromChunks(vectorResults);
  console.log(`   ✅ Found ${entityNames.length} entities in results`);
  
  if (entityNames.length > 0) {
    console.log(`   Entities: ${entityNames.slice(0, 5).join(', ')}${entityNames.length > 5 ? '...' : ''}`);
  }

  // Step 4: Expand via Neo4j graph
  console.log(`\n4️⃣  Expanding via knowledge graph (depth: ${graphDepth})...`);
  const graphExpansion = await expandViaGraph(entityNames, graphDepth);
  console.log(`   ✅ Found ${graphExpansion.relatedEntities.length} related entities`);
  console.log(`   ✅ Found ${graphExpansion.paths.length} graph paths`);

  // Step 5: Retrieve chunks linked to related entities
  console.log(`\n5️⃣  Retrieving chunks for related entities...`);
  const relatedChunkIds = new Set();
  
  for (const entity of graphExpansion.relatedEntities) {
    if (entity.chunk_id) {
      relatedChunkIds.add(entity.chunk_id);
    }
  }

  const graphChunks = relatedChunkIds.size > 0
    ? await getChunksByIds(Array.from(relatedChunkIds))
    : [];
  
  console.log(`   ✅ Retrieved ${graphChunks.length} additional chunks from graph`);

  // Step 6: Combine and deduplicate
  const vectorChunkIds = new Set(vectorResults.map(c => c.chunk_id));
  const uniqueGraphChunks = graphChunks.filter(c => !vectorChunkIds.has(c.chunk_id));
  const allChunks = [...vectorResults, ...uniqueGraphChunks];

  console.log(`\n✅ Hybrid retrieval complete: ${allChunks.length} total chunks`);

  return {
    query,
    vectorChunks: vectorResults,
    graphEntities: graphExpansion.relatedEntities,
    graphChunks: uniqueGraphChunks,
    allChunks,
    graphPaths: includeGraphPaths ? graphExpansion.paths : [],
  };
}

/**
 * Expand entities via Neo4j graph traversal
 * @param {Array<string>} entityNames - Starting entity names
 * @param {number} depth - Traversal depth
 * @returns {Promise<Object>} Related entities and paths
 */
async function expandViaGraph(entityNames, depth = 2) {
  const relatedEntities = [];
  const paths = [];
  const seenEntities = new Set();

  for (const entityName of entityNames) {
    try {
      const related = await findRelatedEntities(entityName, depth);
      
      for (const rel of related) {
        const entityKey = `${rel.type}:${rel.entity.name}`;
        
        if (!seenEntities.has(entityKey)) {
          seenEntities.add(entityKey);
          relatedEntities.push({
            name: rel.entity.name,
            type: rel.type,
            chunk_id: rel.entity.chunk_id,
            doc_id: rel.entity.doc_id,
          });
        }

        // Extract path information
        if (rel.path) {
          paths.push({
            from: entityName,
            to: rel.entity.name,
            depth: rel.path.length,
          });
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not expand entity "${entityName}": ${error.message}`);
    }
  }

  return { relatedEntities, paths };
}

/**
 * Format graph paths for human readability
 * @param {Array} paths - Graph paths
 * @returns {Array<string>} Formatted path descriptions
 */
export function formatGraphPaths(paths) {
  return paths.map(p => 
    `${p.from} → ${p.to} (${p.depth} hop${p.depth > 1 ? 's' : ''})`
  );
}

/**
 * Score and rank chunks by relevance
 * @param {Array} chunks - Chunks to rank
 * @param {Object} options - Ranking options
 * @returns {Array} Ranked chunks
 */
export function rankChunks(chunks, options = {}) {
  const { vectorWeight = 0.7, graphWeight = 0.3 } = options;

  return chunks.map(chunk => {
    let score = 0;
    
    // Vector similarity score
    if (chunk.score !== undefined) {
      score += chunk.score * vectorWeight;
    }
    
    // Graph relevance boost (if came from graph expansion)
    if (chunk.from_graph) {
      score += graphWeight;
    }

    return { ...chunk, combined_score: score };
  }).sort((a, b) => b.combined_score - a.combined_score);
}
