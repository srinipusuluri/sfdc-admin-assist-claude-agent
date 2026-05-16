function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderText(text) {
  if (!text) return null;
  // Convert markdown-style formatting to simple HTML
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="msg-bold">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <li key={i} className="msg-list-item">{line.slice(2)}</li>;
    }
    if (line.startsWith('# ')) {
      return <h4 key={i} className="msg-heading">{line.slice(2)}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h5 key={i} className="msg-subheading">{line.slice(3)}</h5>;
    }
    if (line === '') return <br key={i} />;
    // Bold inline **text**
    const boldParts = line.split(/\*\*(.*?)\*\*/g);
    if (boldParts.length > 1) {
      return (
        <p key={i} className="msg-line">
          {boldParts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      );
    }
    return <p key={i} className="msg-line">{line}</p>;
  });
}

export default function Message({ message }) {
  const { role, text, toolCalls, usage, timestamp } = message;

  if (role === 'user') {
    return (
      <div className="message message-user">
        <div className="message-bubble user-bubble">
          <p>{text}</p>
        </div>
        <span className="message-time">{formatTime(timestamp)}</span>
      </div>
    );
  }

  if (role === 'error') {
    return (
      <div className="message message-error">
        <div className="message-bubble error-bubble">
          <p>{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message message-assistant">
      <div className="assistant-avatar">AI</div>
      <div className="message-content">
        {toolCalls && toolCalls.length > 0 && (
          <div className="tool-calls">
            {toolCalls.map((tc, i) => (
              <span key={i} className="tool-badge">
                🔧 {tc.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
        <div className="message-bubble assistant-bubble">
          {renderText(text)}
        </div>
        <div className="message-meta">
          <span className="message-time">{formatTime(timestamp)}</span>
          {usage && (
            <span className="usage-tag">
              {(usage.totalTokens || 0).toLocaleString()} tokens · ${parseFloat(usage.totalCost || 0).toFixed(5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
