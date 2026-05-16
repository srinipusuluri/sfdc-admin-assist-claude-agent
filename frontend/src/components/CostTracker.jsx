export default function CostTracker({ usage }) {
  const { inputTokens = 0, outputTokens = 0, totalCost = 0 } = usage;
  const totalTokens = inputTokens + outputTokens;

  return (
    <div className="sidebar-card cost-card">
      <h3 className="sidebar-card-title">
        Session Cost
        <span className="model-badge">Haiku</span>
      </h3>
      <div className="cost-display">
        <span className="cost-amount">${typeof totalCost === 'number' ? totalCost.toFixed(6) : '0.000000'}</span>
        <span className="cost-label">USD this session</span>
      </div>
      <div className="token-stats">
        <div className="token-row">
          <span className="token-label">Input tokens</span>
          <span className="token-value">{inputTokens.toLocaleString()}</span>
        </div>
        <div className="token-row">
          <span className="token-label">Output tokens</span>
          <span className="token-value">{outputTokens.toLocaleString()}</span>
        </div>
        <div className="token-row total-row">
          <span className="token-label">Total tokens</span>
          <span className="token-value">{totalTokens.toLocaleString()}</span>
        </div>
      </div>
      <div className="pricing-note">
        $0.80/M input · $4.00/M output
      </div>
    </div>
  );
}
