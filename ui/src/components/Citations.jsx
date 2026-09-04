import './Citations.css';

// Assign a stable color per document name
const PDF_COLORS = [
  { bg: 'rgba(102,126,234,0.12)', border: '#667eea', text: '#4a5fd4' },
  { bg: 'rgba(118,75,162,0.12)',  border: '#764ba2', text: '#6a3d96' },
  { bg: 'rgba(52,199,89,0.12)',   border: '#34c759', text: '#248a3d' },
  { bg: 'rgba(255,159,10,0.12)',  border: '#ff9f0a', text: '#b56800' },
  { bg: 'rgba(255,69,58,0.12)',   border: '#ff453a', text: '#c03228' },
];

function getPdfColor(title, colorMap) {
  if (!colorMap.has(title)) {
    colorMap.set(title, PDF_COLORS[colorMap.size % PDF_COLORS.length]);
  }
  return colorMap.get(title);
}

function Citations({ citations }) {
  // Build a stable color map across all citations
  const colorMap = new Map();
  if (citations) {
    const uniqueTitles = [...new Set(citations.map(c => c.source_title))];
    uniqueTitles.forEach(t => getPdfColor(t, colorMap));
  }

  if (!citations || citations.length === 0) {
    return (
      <div className="citations empty">
        <h3>📄 Sources</h3>
        <p className="empty-message">No citations found</p>
      </div>
    );
  }

  // Group by source document
  const grouped = {};
  for (const cite of citations) {
    const key = cite.source_title || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(cite);
  }

  return (
    <div className="citations">
      <h3>📄 Sources <span className="sources-count">({Object.keys(grouped).length} document{Object.keys(grouped).length > 1 ? 's' : ''})</span></h3>
      <ul className="citations-list">
        {Object.entries(grouped).map(([docTitle, cites], docIdx) => {
          const color = getPdfColor(docTitle, colorMap);
          const pages = [...new Set(cites.map(c => c.page_number).filter(Boolean))].sort((a, b) => a - b);
          return (
            <li key={docIdx} className="citation-item" style={{ borderLeftColor: color.border }}>
              <div className="citation-icon" style={{ background: color.bg, color: color.text }}>
                📄
              </div>
              <div className="citation-content">
                <span className="citation-doc-name" style={{ color: color.text }}>
                  {docTitle.replace(/_/g, ' ')}
                </span>
                <div className="citation-meta">
                  <span className="citation-doc-label" style={{ background: color.bg, color: color.text }}>
                    PDF
                  </span>
                  {pages.length > 0 && (
                    <span className="citation-pages">
                      {pages.length === 1
                        ? `Page ${pages[0]}`
                        : `Pages ${pages.join(', ')}`}
                    </span>
                  )}
                  <span className="citation-refs">{cites.length} chunk{cites.length > 1 ? 's' : ''} used</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Citations;
