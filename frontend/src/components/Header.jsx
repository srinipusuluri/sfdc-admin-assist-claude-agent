export default function Header({ connectionStatus }) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">⚡</span>
        <div>
          <h1 className="header-title">Salesforce Virtual Admin Assistant</h1>
          <p className="header-subtitle">Powered by Claude Haiku · Natural Language Org Management</p>
        </div>
      </div>
      <div className="header-right">
        {connectionStatus.orgId && (
          <span className="org-badge">
            <span className="org-dot" />
            {connectionStatus.username}
          </span>
        )}
      </div>
    </header>
  );
}
