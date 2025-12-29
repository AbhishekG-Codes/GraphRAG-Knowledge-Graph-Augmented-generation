import { useState } from 'react';
import './QueryForm.css';

function QueryForm({ onSubmit, loading }) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(2);
  const [graphDepth, setGraphDepth] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query, { topK, graphDepth });
    }
  };

  const exampleQueries = [
    'Who is Sam Altman?',
    'What companies did Sam Altman found?',
    'Tell me about OpenAI',
    'What is Sam Altman working on?',
  ];

  return (
    <div className="query-form">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="query-input"
          />
          <button type="submit" disabled={loading || !query.trim()} className="submit-btn">
            {loading ? 'Processing...' : 'Search'}
          </button>
        </div>

        <div className="options-row">
          <div className="option">
            <label>Vector Results:</label>
            <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} disabled={loading}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div className="option">
            <label>Graph Depth:</label>
            <select value={graphDepth} onChange={(e) => setGraphDepth(Number(e.target.value))} disabled={loading}>
              <option value={0}>0 (No graph)</option>
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
            </select>
          </div>
        </div>
      </form>

      <div className="examples">
        <span className="examples-label">Try:</span>
        {exampleQueries.map((ex, i) => (
          <button
            key={i}
            onClick={() => setQuery(ex)}
            disabled={loading}
            className="example-btn"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QueryForm;
