import { useState, useEffect, useRef } from 'react';
import Message from './Message';

export default function ChatInterface({ messages, isLoading, onSend, onClear, inputRef }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSubmit(e) {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSend(inputValue.trim());
      setInputValue('');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const SUGGESTIONS = [
    'Deactivate user john@company.com',
    'Change role of sarah@company.com to "VP of Sales"',
    'Transfer all accounts from jane@co.com to bob@co.com',
    'Who owns the account "Acme Corp"?',
  ];

  return (
    <div className="chat-container">
      <div className="chat-toolbar">
        <h2 className="chat-title">Admin Chat</h2>
        <button className="btn-ghost" onClick={onClear} title="Clear conversation">
          Clear
        </button>
      </div>

      <div className="messages-area">
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="assistant-avatar">AI</div>
            <div className="message-content">
              <div className="message-bubble assistant-bubble loading-bubble">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && (
        <div className="suggestions">
          <p className="suggestions-label">Try asking:</p>
          <div className="suggestions-grid">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="suggestion-btn"
                onClick={() => onSend(s)}
                disabled={isLoading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your Salesforce org... (Enter to send)"
          rows={2}
          disabled={isLoading}
        />
        <button
          className="send-btn"
          type="submit"
          disabled={!inputValue.trim() || isLoading}
        >
          {isLoading ? '⏳' : '↑'}
        </button>
      </form>
    </div>
  );
}
