import { useState, useEffect } from 'react';
import './App.css';
import QueryForm from './components/QueryForm';
import AnswerDisplay from './components/AnswerDisplay';
import GraphVisualization from './components/GraphVisualization';
import Citations from './components/Citations';
import QueryHistory from './components/QueryHistory';

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('graphrag-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history');
      }
    }
  }, []);

  // Load last result from localStorage on mount
  useEffect(() => {
    const lastResult = localStorage.getItem('graphrag-last-result');
    if (lastResult) {
      try {
        setResult(JSON.parse(lastResult));
      } catch (e) {
        console.error('Failed to load last result');
      }
    }
  }, []);

  const handleQuery = async (query, options) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          topK: options.topK,
          graphDepth: options.graphDepth,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        // Save to localStorage
        localStorage.setItem('graphrag-last-result', JSON.stringify(data.data));
        // Add to history
        const newHistory = [
          { query, timestamp: Date.now(), result: data.data },
          ...history.slice(0, 9) // Keep last 10
        ];
        setHistory(newHistory);
        localStorage.setItem('graphrag-history', JSON.stringify(newHistory));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to connect to API server. Make sure it is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = (item) => {
    setResult(item.result);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('graphrag-history');
    localStorage.removeItem('graphrag-last-result');
    setResult(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>🔍 GraphRAG Explorer</h1>
            <p>Hybrid Retrieval with Knowledge Graph Reasoning</p>
          </div>
          <div className="header-actions">
            <button 
              className="history-btn"
              onClick={() => setShowHistory(!showHistory)}
            >
              📜 History ({history.length})
            </button>
            {history.length > 0 && (
              <button className="clear-btn" onClick={clearHistory}>
                🗑️ Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {showHistory && history.length > 0 && (
          <QueryHistory 
            history={history} 
            onSelect={loadHistoryItem}
            onClose={() => setShowHistory(false)}
          />
        )}

        <QueryForm onSubmit={handleQuery} loading={loading} />

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="loading-box">
            <div className="spinner"></div>
            <p>Processing query with GraphRAG pipeline...</p>
          </div>
        )}

        {result && !loading && (
          <div className="results-container">
            <AnswerDisplay
              query={result.query}
              answer={result.answer}
              stats={result.stats}
            />

            <div className="grid-container">
              <GraphVisualization graphPaths={result.graphPaths} />
              <Citations citations={result.citations} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
