import './QueryHistory.css';

function QueryHistory({ history, onSelect, onClose }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>📚 Query History</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="history-list">
          {history.map((item, i) => (
            <div 
              key={i} 
              className="history-item"
              onClick={() => onSelect(item)}
            >
              <div className="history-query">{item.query}</div>
              <div className="history-meta">
                <span className="history-time">{formatTime(item.timestamp)}</span>
                <span className="history-stats">
                  {item.result.stats.totalChunks} chunks • {item.result.stats.graphPathCount} paths
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default QueryHistory;
