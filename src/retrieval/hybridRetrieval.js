import { generateEmbedding, createEmbeddingModel } from '../utils/embeddingGenerator.js';
import { getChunksByDocId, getChunksByIds, keywordSearch, vectorSearch } from '../database/mongodbClient.js';
import { findEntitiesByName, findRelatedEntities } from '../database/neo4jClient.js';
import { config } from '../../config.js';

const MAX_GRAPH_SEEDS = 3;
const MAX_GRAPH_PATHS = 15;
const MAX_GRAPH_CHUNKS = 10;

/**
 * Diversify search results while preserving the strongest ranked evidence.
 *
 * Algorithm:
 *   1. Preserve the top two chunks unchanged, so focused questions retain
 *      enough evidence from their best matching source.
 *   2. Add the highest-scored chunk from other documents when slots remain.
 *   3. Fill remaining slots in score order.
 *
 * This reduces the chance that a single very-relevant document monopolises all
 * slots. It cannot surface documents that Atlas did not return as candidates.
 *
 * @param {Array}  chunks - Scored chunks from vector search (highest score first)
 * @param {number} topK   - Final number of chunks to return
 * @returns {Array} Diversified, topK-length chunk array
 */
function diversifyChunks(chunks, topK) {
  if (chunks.length <= topK) return chunks;

  const byDoc = new Map();
  for (const chunk of chunks) {
    const key = chunk.doc_id || chunk.source_title || 'unknown';
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key).push(chunk);
  }

  const selected = chunks.slice(0, Math.min(2, topK));
  const selectedIds = new Set(selected.map(chunk => chunk.chunk_id));
  const selectedDocumentIds = new Set(
    selected.map(chunk => chunk.doc_id || chunk.source_title || 'unknown')
  );

  // Add one representative from each alternate document, retaining score order.
  for (const [docId, queue] of byDoc) {
    if (selected.length >= topK) break;
    if (selectedDocumentIds.has(docId)) continue;

    const candidate = queue.find(chunk => !selectedIds.has(chunk.chunk_id));
    if (candidate) {
      selected.push(candidate);
      selectedIds.add(candidate.chunk_id);
      selectedDocumentIds.add(docId);
    }
  }

  // Fill remaining slots with the strongest unselected chunks.
  if (selected.length < topK) {
    const remaining = chunks.filter(c => !selectedIds.has(c.chunk_id));
    for (const c of remaining) {
      if (selected.length >= topK) break;
      selected.push(c);
    }
  }

  return selected;
}

function rankEntityNames(entityNames, query) {
  const normalizedQuery = query.toLowerCase();

  return entityNames.sort((a, b) => {
    const score = name => {
      const normalizedName = name.toLowerCase();
      if (normalizedQuery.includes(normalizedName)) return 100;

      return normalizedName
        .split(/\s+/)
        .filter(token => token.length > 2 && normalizedQuery.includes(token))
        .length;
    };

    return score(b) - score(a) || a.localeCompare(b);
  });
}

function isDefinitionQuestion(query) {
  return /^(who|what)\s+(is|are)\b|^(tell me about|describe)\b/i.test(query.trim());
}

function normalizeTitle(title) {
  return (title || '').replace(/_/g, ' ').toLowerCase().trim();
}

async function prioritizeDocumentIntroduction(chunks, query, topK) {
  if (!isDefinitionQuestion(query)) return chunks;

  const normalizedQuery = query.toLowerCase();
  const matchedChunk = chunks.find(chunk => {
    const title = normalizeTitle(chunk.source_title);
    return title.length > 0 && normalizedQuery.includes(title);
  });

  if (!matchedChunk?.doc_id) return chunks;

  try {
    const documentChunks = await getChunksByDocId(matchedChunk.doc_id);
    const introductions = documentChunks
      .sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0))
      .slice(0, 2);
    const seenChunkIds = new Set();

    return [...introductions, ...chunks]
      .filter(chunk => {
        if (seenChunkIds.has(chunk.chunk_id)) return false;
        seenChunkIds.add(chunk.chunk_id);
        return true;
      })
      .slice(0, topK);
  } catch (error) {
    console.log(`   ⚠️  Could not prioritize document introduction: ${error.message}`);
    return chunks;
  }
}

/**
 * Extract entity names from text chunks by looking them up in Neo4j
 * Uses fuzzy text matching to find entities mentioned in chunks
 * @param {Array} chunks - Array of chunk objects
 * @returns {Promise<Array<string>>} List of entity names found in graph
 */
export async function extractEntityNamesFromChunks(chunks, query = '') {
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
  
  return rankEntityNames(Array.from(entityNames), query);
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

  // Step 2: Vector search — fetch extra candidates then diversify across documents
  //   We request topK×4 from MongoDB so the diversity filter has enough material
  //   to represent more than one source when those documents are retrieved.
  const fetchK = Math.max(topK * 4, 20);
  console.log(`\n2️⃣  Performing vector search (fetching ${fetchK} candidates, keeping ${topK} diverse)...`);
  let rawResults = [];
  try {
    rawResults = await vectorSearch(queryEmbedding, fetchK);
  } catch (error) {
    // Missing/unready Atlas indexes throw rather than returning an empty result.
    // Treat that the same as an empty vector result so keyword retrieval remains usable.
    console.log(`   ⚠️  Vector search unavailable: ${error.message}`);
  }

  if (rawResults.length === 0) {
    console.log('\n2️⃣  Vector search returned no chunks, trying keyword fallback...');
    const fallbackResults = await keywordSearch(query, topK);

    if (fallbackResults.length > 0) {
      console.log(`   ✅ Fallback found ${fallbackResults.length} chunks`);
      return {
        query,
        vectorChunks: fallbackResults,
        graphEntities: [],
        graphChunks: [],
        allChunks: fallbackResults,
        graphPaths: [],
      };
    }

    return {
      query,
      vectorChunks: [],
      graphEntities: [],
      graphChunks: [],
      allChunks: [],
      graphPaths: [],
    };
  }

  const diversifiedResults = diversifyChunks(rawResults, topK);
  const vectorResults = await prioritizeDocumentIntroduction(diversifiedResults, query, topK);
  const uniqueDocs = [...new Set(vectorResults.map(c => c.source_title))];
  console.log(`   ✅ Kept ${vectorResults.length} chunks across ${uniqueDocs.length} document(s): ${uniqueDocs.join(', ')}`);

  // Step 3: Extract entities from vector results
  console.log(`\n3️⃣  Extracting entities from chunks...`);
  const entityNames = (await extractEntityNamesFromChunks(vectorResults, query)).slice(0, MAX_GRAPH_SEEDS);
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
    ? await getChunksByIds(Array.from(relatedChunkIds).slice(0, MAX_GRAPH_CHUNKS))
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
    if (paths.length >= MAX_GRAPH_PATHS) break;

    try {
      const related = await findRelatedEntities(entityName, depth);
      
      for (const rel of related) {
        if (paths.length >= MAX_GRAPH_PATHS) break;

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
