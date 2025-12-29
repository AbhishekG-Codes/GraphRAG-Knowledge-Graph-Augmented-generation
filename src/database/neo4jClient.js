import neo4j from 'neo4j-driver';
import { config } from '../../config.js';

let driver = null;

/**
 * Connect to Neo4j database
 * @returns {Promise<Driver>}
 */
export async function connectNeo4j() {
  if (driver) {
    return driver;
  }

  try {
    console.log('🔌 Connecting to Neo4j...');
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
    );

    // Verify connection
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j\n');
    return driver;
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error);
    throw error;
  }
}

/**
 * Close Neo4j connection
 */
export async function closeNeo4j() {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('Neo4j connection closed');
  }
}

/**
 * Get Neo4j session
 * @returns {Session}
 */
export function getSession() {
  if (!driver) {
    throw new Error('Neo4j not connected. Call connectNeo4j() first.');
  }
  return driver.session();
}

/**
 * Create or merge a Person node
 * @param {string} name - Person name
 * @param {Object} properties - Additional properties
 * @returns {Promise<Object>} Created/merged node
 */
export async function createPersonNode(name, properties = {}) {
  const session = getSession();
  try {
    const result = await session.run(
      `MERGE (p:Person {name: $name})
       SET p += $properties
       RETURN p`,
      { name, properties }
    );
    return result.records[0]?.get('p').properties;
  } finally {
    await session.close();
  }
}

/**
 * Create or merge a Company node
 * @param {string} name - Company name
 * @param {Object} properties - Additional properties
 * @returns {Promise<Object>} Created/merged node
 */
export async function createCompanyNode(name, properties = {}) {
  const session = getSession();
  try {
    const result = await session.run(
      `MERGE (c:Company {name: $name})
       SET c += $properties
       RETURN c`,
      { name, properties }
    );
    return result.records[0]?.get('c').properties;
  } finally {
    await session.close();
  }
}

/**
 * Create or merge a Product node
 * @param {string} name - Product name
 * @param {Object} properties - Additional properties
 * @returns {Promise<Object>} Created/merged node
 */
export async function createProductNode(name, properties = {}) {
  const session = getSession();
  try {
    const result = await session.run(
      `MERGE (p:Product {name: $name})
       SET p += $properties
       RETURN p`,
      { name, properties }
    );
    return result.records[0]?.get('p').properties;
  } finally {
    await session.close();
  }
}

/**
 * Create or merge a Field node
 * @param {string} name - Field name
 * @param {Object} properties - Additional properties
 * @returns {Promise<Object>} Created/merged node
 */
export async function createFieldNode(name, properties = {}) {
  const session = getSession();
  try {
    const result = await session.run(
      `MERGE (f:Field {name: $name})
       SET f += $properties
       RETURN f`,
      { name, properties }
    );
    return result.records[0]?.get('f').properties;
  } finally {
    await session.close();
  }
}

/**
 * Create a relationship between two entities
 * @param {string} fromType - Source entity type (Person, Company, etc.)
 * @param {string} fromName - Source entity name
 * @param {string} relType - Relationship type (CEO_OF, INVESTED_IN, etc.)
 * @param {string} toType - Target entity type
 * @param {string} toName - Target entity name
 * @param {Object} properties - Relationship properties (provenance)
 * @returns {Promise<Object>} Created relationship
 */
export async function createRelationship(fromType, fromName, relType, toType, toName, properties = {}) {
  const session = getSession();
  try {
    // Sanitize labels and relationship types to ensure they're valid
    const sanitizeLabel = (label) => label.replace(/[^a-zA-Z0-9_]/g, '_');
    const fromLabel = sanitizeLabel(fromType);
    const toLabel = sanitizeLabel(toType);
    const relLabel = sanitizeLabel(relType);
    
    const query = `
      MERGE (from:\`${fromLabel}\` {name: $fromName})
      MERGE (to:\`${toLabel}\` {name: $toName})
      MERGE (from)-[r:\`${relLabel}\`]->(to)
      SET r += $properties
      RETURN r
    `;
    
    const result = await session.run(query, { fromName, toName, properties });
    return result.records[0]?.get('r').properties;
  } finally {
    await session.close();
  }
}

/**
 * Store extracted entities and relationships from a chunk
 * @param {Object} extraction - Extracted entities and relationships
 * @param {string} chunkId - Chunk ID for provenance
 * @param {string} docId - Document ID for provenance
 * @returns {Promise<Object>} Storage result
 */
export async function storeExtraction(extraction, chunkId, docId) {
  const provenance = {
    chunk_id: chunkId,
    doc_id: docId,
    extracted_at: new Date().toISOString(),
  };

  const results = {
    entities: 0,
    relationships: 0,
  };

  // Store entities
  if (extraction.entities) {
    for (const entity of extraction.entities) {
      const props = { ...provenance };
      
      switch (entity.type) {
        case 'Person':
          await createPersonNode(entity.name, props);
          break;
        case 'Company':
          await createCompanyNode(entity.name, props);
          break;
        case 'Product':
          await createProductNode(entity.name, props);
          break;
        case 'Field':
          await createFieldNode(entity.name, props);
          break;
      }
      results.entities++;
    }
  }

  // Store relationships
  if (extraction.relationships) {
    for (const rel of extraction.relationships) {
      await createRelationship(
        rel.from_type,
        rel.from,
        rel.type,
        rel.to_type,
        rel.to,
        provenance
      );
      results.relationships++;
    }
  }

  return results;
}

/**
 * Find entities by name
 * @param {string} name - Entity name
 * @param {string} type - Optional entity type filter
 * @returns {Promise<Array>} Matching entities
 */
export async function findEntitiesByName(name, type = null) {
  const session = getSession();
  try {
    const query = type
      ? `MATCH (e:${type} {name: $name}) RETURN e, labels(e) as labels`
      : `MATCH (e {name: $name}) RETURN e, labels(e) as labels`;
    
    const result = await session.run(query, { name });
    return result.records.map(record => ({
      ...record.get('e').properties,
      type: record.get('labels')[0],
    }));
  } finally {
    await session.close();
  }
}

/**
 * Find relationships for an entity
 * @param {string} entityName - Entity name
 * @param {number} depth - Traversal depth (1 or 2 hops)
 * @returns {Promise<Array>} Related entities and paths
 */
export async function findRelatedEntities(entityName, depth = 1) {
  const session = getSession();
  try {
    const query = `
      MATCH path = (start {name: $entityName})-[*1..${depth}]-(related)
      RETURN path, related, labels(related) as labels
      LIMIT 50
    `;
    
    const result = await session.run(query, { entityName });
    return result.records.map(record => ({
      entity: record.get('related').properties,
      type: record.get('labels')[0],
      path: record.get('path'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get graph statistics
 * @returns {Promise<Object>} Graph statistics
 */
export async function getGraphStats() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n)
      OPTIONAL MATCH ()-[r]->()
      RETURN 
        count(DISTINCT n) as nodes,
        count(DISTINCT r) as relationships,
        count(DISTINCT labels(n)) as nodeTypes
    `);
    
    const record = result.records[0];
    return {
      nodes: record.get('nodes').toNumber(),
      relationships: record.get('relationships').toNumber(),
      nodeTypes: record.get('nodeTypes').toNumber(),
    };
  } finally {
    await session.close();
  }
}

/**
 * Clear all data from Neo4j (use with caution!)
 */
export async function clearAllData() {
  const session = getSession();
  try {
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✅ All Neo4j data cleared');
  } finally {
    await session.close();
  }
}
