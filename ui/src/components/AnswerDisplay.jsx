import './AnswerDisplay.css';

function AnswerDisplay({ query, answer, stats }) {
  return (
    <div className="answer-display">
      <div className="query-section">
        <h3>Question</h3>
        <p className="query-text">{query}</p>
      </div>

      <div className="answer-section">
        <h3>Answer</h3>
        <p className="answer-text">{answer}</p>
      </div>

      <div className="stats-section">
        <div className="stat">
          <span className="stat-label">Vector Chunks:</span>
          <span className="stat-value">{stats.vectorChunks}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Graph Chunks:</span>
          <span className="stat-value">{stats.graphChunks}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Retrieved:</span>
          <span className="stat-value">{stats.totalChunks}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Graph Paths:</span>
          <span className="stat-value">{stats.graphPathCount}</span>
        </div>
      </div>
    </div>
  );
}

export default AnswerDisplay;
