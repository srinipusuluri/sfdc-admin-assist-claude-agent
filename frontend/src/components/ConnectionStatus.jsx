export default function ConnectionStatus({ status, onRefresh }) {
  if (status.checking) {
    return (
      <div className="sidebar-card">
        <h3 className="sidebar-card-title">Connection</h3>
        <div className="status-row">
          <span className="status-dot checking" />
          <span className="status-text">Connecting to Salesforce...</span>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="sidebar-card">
        <h3 className="sidebar-card-title">Connection</h3>
        <div className="status-row">
          <span className="status-dot disconnected" />
          <span className="status-text error-text">Not connected</span>
        </div>
        {status.error && <p className="status-error">{status.error}</p>}
        <button className="btn-secondary small" onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className="sidebar-card">
      <h3 className="sidebar-card-title">Connection</h3>
      <div className="status-row">
        <span className="status-dot connected" />
        <span className="status-text success-text">Connected</span>
      </div>
      <div className="status-details">
        <div className="status-detail-row">
          <span className="detail-label">User</span>
          <span className="detail-value">{status.displayName || status.username}</span>
        </div>
        <div className="status-detail-row">
          <span className="detail-label">Auth</span>
          <span className="detail-value" style={{color: status.authMethod?.includes('OAuth') ? '#4bca81' : '#e8e8e8'}}>
            {status.authMethod || 'Password'}
          </span>
        </div>
        <div className="status-detail-row">
          <span className="detail-label">Org ID</span>
          <span className="detail-value mono">{status.orgId?.slice(0, 15)}…</span>
        </div>
        {status.instanceUrl && (
          <div className="status-detail-row">
            <span className="detail-label">Instance</span>
            <a
              className="detail-value link"
              href={status.instanceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Org ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
