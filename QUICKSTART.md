# GraphRAG System - Complete Setup

## ✅ System Status

All components are installed and configured:
- ✅ MongoDB Atlas (vector search)
- ✅ Neo4j (knowledge graph)
- ✅ Ollama (LLM & embeddings)
- ✅ PDF ingestion pipeline
- ✅ Entity extraction
- ✅ Hybrid retrieval engine
- ✅ Answer generation
- ✅ Web UI

## 🚀 Quick Start

### Option 1: Using the Web UI (Recommended)

**One command - full startup:**
```bash
npm run start
```

Then open http://localhost:5173 in your browser.

If you want to run them separately:

```bash
npm run api
npm run ui
```

### Option 2: Using CLI

**Interactive mode:**
```bash
node query-graphrag.js --interactive
```

**Single query:**
```bash
node query-graphrag.js "Who is Sam Altman?"
```

## 📊 Current Data

- **Documents**: 1 PDF (Sam_Altman.pdf)
- **Chunks**: 173 text chunks with embeddings
- **Entities**: 35 nodes (People, Companies, Products, etc.)
- **Relationships**: 27 edges (FOUNDED, CEO_OF, WORKS_ON, etc.)

## 🔧 Management Scripts

### Ingest New PDFs
```bash
node ingest-pdfs.js path/to/document.pdf
```

### Extract Entities from Documents
```bash
node extract-entities.js
```

### Test Components
```bash
# Test vector search
node query-graphrag.js "test query"

# Check Neo4j graph
# Open http://localhost:7474 in browser
```

## 📁 Project Structure

```
langgraph/
├── src/
│   ├── database/          # MongoDB & Neo4j clients
│   ├── extraction/        # Entity extraction
│   ├── ingestion/         # PDF processing
│   ├── query/            # Query engine
│   ├── retrieval/        # Hybrid retrieval
│   └── utils/            # PDF, embeddings
├── ui/                   # React visualization UI
├── api-server.js         # Express API
├── query-graphrag.js     # CLI query tool
├── ingest-pdfs.js        # PDF ingestion script
└── extract-entities.js   # Entity extraction script
```

## 🎯 What You Can Do

1. **Ask Questions**: Query your documents through UI or CLI
2. **Upload PDFs**: Add new documents to the knowledge base
3. **Visualize**: See graph paths and relationships
4. **Verify Sources**: Check citations and provenance
5. **Adjust Settings**: Configure vector search depth and graph traversal

## 🔍 Example Queries

- "Who is Sam Altman?"
- "What companies did Sam Altman found?"
- "Tell me about OpenAI"
- "What is Sam Altman working on?"
- "Explain the relationship between Y Combinator and OpenAI"

## 📝 Notes

- **Response Time**: ~60s per query (Ollama processing)
- **Graph Depth**: 
  - 0 = Vector search only (no graph)
  - 1 = 1-hop neighbors (faster)
  - 2 = 2-hop neighbors (more comprehensive)
- **Vector Results**: More chunks = more context but slower

## 🐛 Troubleshooting

**UI not connecting to API:**
- Ensure API server is running: `npm run api`
- Check http://localhost:3001/api/health

**Ollama timeouts:**
- Reduce graph depth to 1
- Reduce vector results to 2
- Ensure Ollama is running: `ollama list`

**Database connection errors:**
- Check .env file configuration
- Verify MongoDB Atlas and Neo4j are accessible
