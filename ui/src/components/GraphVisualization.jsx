import './GraphVisualization.css';

function GraphVisualization({ graphPaths }) {
  if (!graphPaths || graphPaths.length === 0) {
    return (
      <div className="graph-visualization empty">
        <h3>Knowledge Graph Paths</h3>
        <p className="empty-message">No graph paths (try increasing graph depth)</p>
      </div>
    );
  }

  return (
    <div className="graph-visualization">
      <h3>Knowledge Graph Paths ({graphPaths.length})</h3>
      <div className="paths-list">
        {graphPaths.slice(0, 15).map((path, i) => (
          <div key={i} className="graph-path">
            <span className="path-number">{i + 1}.</span>
            <span className="path-content">{formatPath(path)}</span>
          </div>
        ))}
        {graphPaths.length > 15 && (
          <p className="more-paths">+ {graphPaths.length - 15} more paths</p>
        )}
      </div>
    </div>
  );
}

function formatPath(path) {
  // Handle different path formats
  if (typeof path === 'object' && path.from && path.to) {
    // Format: {from, to, depth}
    const hops = path.depth === 1 ? '1 hop' : `${path.depth} hops`;
    return `${path.from} → ${path.to} (${hops})`;
  } else if (Array.isArray(path) && path.length === 3) {
    // Format: [entity1, relationship, entity2]
    return `${path[0]} → [${path[1]}] → ${path[2]}`;
  }
  return JSON.stringify(path);
}

export default GraphVisualization;
