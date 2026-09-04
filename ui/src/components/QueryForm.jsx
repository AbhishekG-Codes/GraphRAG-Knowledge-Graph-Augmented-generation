import { useState } from 'react';
import './QueryForm.css';

// Suggested questions that deliberately span two different PDFs
const SUGGESTED_QUESTIONS = [
  {
    label: 'Sam Altman & OpenAI',
    question: 'Who is Sam Altman and what is his role at OpenAI?',
    pdfs: ['Sam_Altman', 'OpenAI'],
  },
  {
    label: 'Microsoft & OpenAI',
    question: 'How is Microsoft connected to OpenAI and what did they invest in?',
    pdfs: ['Microsoft', 'OpenAI'],
  },
  {
    label: 'All sources',
    question: 'What are the key AI developments from OpenAI and Microsoft?',
    pdfs: ['OpenAI', 'Microsoft', 'Artificial_intelligence'],
  },
  {
    label: 'AI & OpenAI',
    question: 'What is artificial intelligence and how does OpenAI contribute to it?',
    pdfs: ['Artificial_intelligence', 'OpenAI'],
  },
];

function QueryForm({ onSubmit, loading }) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [graphDepth, setGraphDepth] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query, { topK, graphDepth });
    }
  };

  const useQuestion = (q) => {
    setQuery(q);
  };

  return (
    <div className="query-form">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
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
              <option value={5}>5 (default)</option>
              <option value={8}>8</option>
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

      {/* Suggested questions — each labelled with which PDFs they draw from */}
      <div className="suggestions">
        <span className="suggestions-label">💡 Try these cross-document questions:</span>
        <div className="suggestion-cards">
          {SUGGESTED_QUESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => useQuestion(s.question)}
              disabled={loading}
              className="suggestion-card"
            >
              <span className="suggestion-question">{s.question}</span>
              <span className="suggestion-sources">
                {s.pdfs.map((pdf) => (
                  <span key={pdf} className="suggestion-pdf-badge">{pdf.replace(/_/g, ' ')}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default QueryForm;
