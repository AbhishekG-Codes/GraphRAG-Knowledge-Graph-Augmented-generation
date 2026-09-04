/**
 * npm run start — GraphRAG Startup Script
 *
 * What this does, in order:
 *   1. Start Ollama (if not running)
 *   2. Ensure required models are available (llama3.1:8b + nomic-embed-text)
 *   3. Start Neo4j (if not running)
 *   4. Ingest PDFs from ./data/ into MongoDB (skipped if already done)
 *   5. Build the knowledge graph in Neo4j (skipped if already done)
 *   6. Start the API server + UI in the background
 *   7. Drop into an interactive Q&A session — type your question, get an answer
 */

import { spawn, execFileSync, execSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { ingestPDFs } from '../src/ingestion/ingestPipeline.js';
import { extractEntitiesFromChunks } from '../src/extraction/extractionPipeline.js';
import { connectMongoDB, closeMongoDB, getCollectionStats, getIngestedSourceTitles } from '../src/database/mongodbClient.js';
import { connectNeo4j, closeNeo4j, getGraphStats } from '../src/database/neo4jClient.js';
import { queryGraphRAG, formatQueryResult } from '../src/query/queryEngine.js';

const scriptDir  = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const dataDir    = path.join(projectRoot, 'data');

// ─── Read service config from .env ────────────────────────────────────────────
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const ollamaHost    = new URL(ollamaBaseUrl).hostname;
const ollamaPort    = Number(new URL(ollamaBaseUrl).port || 11434);
const neo4jPort     = process.env.NEO4J_PORT ? Number(process.env.NEO4J_PORT) : 7687;
const CHAT_MODEL    = process.env.OLLAMA_MODEL           || 'llama3.1:8b';
const EMBED_MODEL   = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function banner() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🧠  GraphRAG — Knowledge Graph + RAG System');
  console.log('═'.repeat(60) + '\n');
}

function step(n, total, label) {
  console.log(`\n[${n}/${total}] ${label}`);
  console.log('─'.repeat(50));
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = new net.Socket();
    const done   = v => { socket.destroy(); resolve(v); };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error',   () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, host, label, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port, host)) {
      console.log(`  ✅ ${label} is ready`);
      return true;
    }
    await new Promise(r => setTimeout(r, 1500));
    process.stdout.write('.');
  }
  console.log(`\n  ⚠️  Timed out waiting for ${label}`);
  return false;
}

function runDetached(command, args, label) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'ignore',
    env: process.env,
    shell: false,
    detached: true,
  });
  child.on('error', err => console.log(`  ⚠️  Could not start ${label}: ${err.message}`));
  child.unref();
  console.log(`  ▶️  Launched: ${label}`);
}

function startProcess(command, args, label, cwd = projectRoot) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  child.on('exit', (code, signal) => {
    if (!shutdownRequested) {
      console.log(`\n  ${label} stopped (code=${code}, signal=${signal})`);
    }
  });
  return child;
}

async function getPdfFiles() {
  try {
    const entries = await readdir(dataDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
      .map(e => path.join(dataDir, e.name));
  } catch {
    return [];
  }
}

// ─── Step handlers ────────────────────────────────────────────────────────────

async function ensureOllama() {
  if (await isPortOpen(ollamaPort, ollamaHost)) {
    console.log(`  ✅ Ollama already running on port ${ollamaPort}`);
    return;
  }

  console.log('  Starting Ollama...');
  // Try brew first, fall back to direct command
  try {
    execSync('brew services start ollama', { stdio: 'pipe' });
    console.log('  ▶️  Started via: brew services start ollama');
  } catch {
    runDetached('ollama', ['serve'], 'ollama serve');
  }

  await waitForPort(ollamaPort, ollamaHost, 'Ollama');
}

async function ensureModel(modelName, purpose) {
  console.log(`  Checking ${purpose} model: ${modelName}`);
  try {
    const list = execFileSync('ollama', ['list'], { encoding: 'utf8' });
    const installed = list
      .split(/\r?\n/)
      .some(line => line.trim().split(/\s+/)[0] === modelName);
    if (installed) {
      console.log(`  ✅ ${modelName} — already available`);
      return;
    }
  } catch { /* ignore */ }

  console.log(`  ⬇️  Pulling ${modelName} (this may take a while)...`);
  try {
    execFileSync('ollama', ['pull', modelName], { stdio: 'inherit' });
    console.log(`  ✅ ${modelName} — pulled successfully`);
  } catch (err) {
    console.log(`  ⚠️  Could not pull ${modelName}: ${err.message}`);
  }
}

async function ensureNeo4j() {
  if (await isPortOpen(neo4jPort, '127.0.0.1')) {
    console.log(`  ✅ Neo4j already running on port ${neo4jPort}`);
    return;
  }

  console.log('  Starting Neo4j...');
  try {
    execSync('brew services start neo4j', { stdio: 'pipe' });
    console.log('  ▶️  Started via: brew services start neo4j');
  } catch {
    runDetached('neo4j', ['start'], 'neo4j start');
  }

  await waitForPort(neo4jPort, '127.0.0.1', 'Neo4j', 60000);
}

async function maybeIngestPdfs() {
  const pdfFiles = await getPdfFiles();

  if (pdfFiles.length === 0) {
    console.log('  ℹ️  No PDFs found in ./data/ — skipping ingestion');
    return [];
  }

  await connectMongoDB();
  const stats = await getCollectionStats();
  const ingestedTitles = new Set(await getIngestedSourceTitles());
  await closeMongoDB();

  const newPdfFiles = pdfFiles.filter(file => {
    const sourceTitle = path.basename(file, path.extname(file));
    return !ingestedTitles.has(sourceTitle);
  });

  if (newPdfFiles.length === 0) {
    console.log(`  ✅ No new PDFs to ingest — MongoDB has ${stats.total_chunks} chunks across ${stats.unique_documents} document(s)`);
    return [];
  }

  console.log(`  📂 Ingesting ${newPdfFiles.length} new PDF(s):`);
  newPdfFiles.forEach((f, i) => console.log(`     ${i + 1}. ${path.basename(f)}`));
  console.log('');
  const result = await ingestPDFs(newPdfFiles);
  return result.documents?.map(document => document.doc_id) || [];
}

async function maybeBuildGraph(newDocumentIds) {
  await connectNeo4j();
  const stats = await getGraphStats();
  await closeNeo4j();

  if (newDocumentIds.length > 0) {
    console.log(`  🔨 Building graph for ${newDocumentIds.length} newly ingested document(s)...`);
    for (const docId of newDocumentIds) {
      await extractEntitiesFromChunks({ docId, batchSize: 10 });
    }
    return;
  }

  if (stats.nodes > 0 && stats.relationships > 0) {
    console.log(`  ✅ Graph already built — ${stats.nodes} nodes, ${stats.relationships} relationships`);
    return;
  }

  console.log('  🔨 Building knowledge graph from chunks...');
  await extractEntitiesFromChunks({ limit: null, batchSize: 10 });
}

// ─── Interactive Q&A ──────────────────────────────────────────────────────────

async function runInteractiveQA() {
  console.log('\n' + '═'.repeat(60));
  console.log('  💬  GraphRAG — Interactive Q&A');
  console.log('  Type your question and press Enter. Type "exit" to quit.');
  console.log('═'.repeat(60) + '\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question('❓ Your question: ', async input => {
      const question = input.trim();

      if (!question) { ask(); return; }
      if (['exit', 'quit', 'q'].includes(question.toLowerCase())) {
        console.log('\n👋 Goodbye!\n');
        rl.close();
        await shutdown(0);
        return;
      }

      try {
        console.log('\n⏳ Thinking...\n');
        const result = await queryGraphRAG(question, { topK: 5, graphDepth: 1, verbose: false });
        console.log(formatQueryResult(result));
      } catch (err) {
        console.error(`\n❌ Error: ${err.message}\n`);
      }

      ask();
    });
  };

  ask();
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

let apiProcess = null;
let uiProcess  = null;
let shutdownRequested = false;

async function shutdown(code = 0) {
  if (shutdownRequested) return;
  shutdownRequested = true;
  apiProcess?.kill('SIGINT');
  uiProcess?.kill('SIGINT');
  await Promise.allSettled([closeMongoDB(), closeNeo4j()]);
  process.exit(code);
}

process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ─── Main ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

try {
  banner();

  step(1, TOTAL_STEPS, 'Starting Ollama');
  await ensureOllama();

  step(2, TOTAL_STEPS, 'Ensuring AI models are available');
  await ensureModel(CHAT_MODEL,  'chat/reasoning');
  await ensureModel(EMBED_MODEL, 'embeddings');

  step(3, TOTAL_STEPS, 'Starting Neo4j');
  await ensureNeo4j();

  step(4, TOTAL_STEPS, 'Ingesting PDFs → MongoDB');
  const newDocumentIds = await maybeIngestPdfs();

  step(5, TOTAL_STEPS, 'Building knowledge graph → Neo4j');
  await maybeBuildGraph(newDocumentIds);

  step(6, TOTAL_STEPS, 'Starting background services (API + UI)');
  apiProcess = startProcess('node', ['api-server.js'],         'API server');
  uiProcess  = startProcess('npm',  ['run', 'ui'],             'UI server',  projectRoot);
  console.log('  ✅ API  → http://localhost:3001');
  console.log('  ✅ UI   → http://localhost:5173  (or check terminal above)');

  step(7, TOTAL_STEPS, 'Ready! Starting interactive Q&A');
  await runInteractiveQA();

} catch (error) {
  console.error('\n❌ Startup failed:', error.message);
  console.error(error.stack);
  await shutdown(1);
}
