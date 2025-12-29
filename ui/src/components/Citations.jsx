import './Citations.css';

function Citations({ citations }) {
  if (!citations || citations.length === 0) {
    return (
      <div className="citations empty">
        <h3>Source Citations</h3>
        <p className="empty-message">No citations found</p>
      </div>
    );
  }

  return (
    <div className="citations">
      <h3>Source Citations ({citations.length})</h3>
      <ul className="citations-list">
        {citations.map((cite, i) => (
          <li key={i} className="citation-item">
            <span className="citation-number">[{i + 1}]</span>
            <div className="citation-content">
              <strong>{cite.source_title}</strong>
              {cite.page_number && <span className="page-info"> • Page {cite.page_number}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Citations;
