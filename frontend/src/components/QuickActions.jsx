const ACTIONS = [
  { label: 'List Active Users', prompt: 'List all active users in the org', icon: '👥', category: 'Users' },
  { label: 'Inactive Users', prompt: 'Show all inactive users', icon: '🚫', category: 'Users' },
  { label: 'List Roles', prompt: 'Show me all roles in the org hierarchy', icon: '🏢', category: 'Roles' },
  { label: 'List Profiles', prompt: 'Show all available profiles', icon: '🎭', category: 'Roles' },
  { label: 'My Accounts', prompt: 'List recent Accounts with their owners', icon: '🏦', category: 'Records' },
  { label: 'My Opportunities', prompt: 'List recent Opportunities with their owners', icon: '💰', category: 'Records' },
  { label: 'Open Leads', prompt: 'List recent Leads with their owners', icon: '🎯', category: 'Records' },
  { label: 'Recent Cases', prompt: 'List recent Cases with their owners', icon: '📋', category: 'Records' },
];

const CATEGORIES = ['Users', 'Roles', 'Records'];

export default function QuickActions({ onAction, disabled }) {
  return (
    <div className="sidebar-card">
      <h3 className="sidebar-card-title">Quick Actions</h3>
      {CATEGORIES.map((cat) => (
        <div key={cat} className="action-category">
          <p className="action-category-label">{cat}</p>
          <div className="action-grid">
            {ACTIONS.filter((a) => a.category === cat).map((action) => (
              <button
                key={action.label}
                className="action-btn"
                onClick={() => onAction(action.prompt)}
                disabled={disabled}
                title={action.prompt}
              >
                <span className="action-icon">{action.icon}</span>
                <span className="action-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
