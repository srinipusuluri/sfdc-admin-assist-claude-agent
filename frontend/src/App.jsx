import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import QuickActions from './components/QuickActions';
import CostTracker from './components/CostTracker';
import ConnectionStatus from './components/ConnectionStatus';

const SESSION_ID = 'sfdc-admin-' + Date.now();

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your Salesforce Virtual Admin Assistant. I can help you manage users, update roles, and transfer record ownership — just ask me in plain English.\n\nFor example:\n- \"List all active users\"\n- \"Show me the role of john@company.com\"\n- \"Transfer all accounts from Jane to Bob\"\n- \"Deactivate user sarah@company.com\"",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ checking: true });
  const [totalUsage, setTotalUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const inputRef = useRef(null);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setConnectionStatus({ checking: true });
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setConnectionStatus(data);
    } catch {
      setConnectionStatus({ connected: false, error: 'Backend unreachable' });
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.text,
          toolCalls: data.toolCalls,
          usage: data.usage,
          timestamp: new Date(),
        },
      ]);

      setTotalUsage((prev) => ({
        inputTokens: prev.inputTokens + (data.usage?.inputTokens || 0),
        outputTokens: prev.outputTokens + (data.usage?.outputTokens || 0),
        totalCost: +(prev.totalCost + parseFloat(data.usage?.totalCost || 0)).toFixed(6),
      }));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: `Error: ${err.message}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function clearChat() {
    await fetch(`/api/chat/${SESSION_ID}`, { method: 'DELETE' }).catch(() => {});
    setMessages([
      {
        role: 'assistant',
        text: "Chat cleared! How can I help you manage your Salesforce org?",
        timestamp: new Date(),
      },
    ]);
  }

  return (
    <div className="app">
      <Header connectionStatus={connectionStatus} onRefreshConnection={checkConnection} />
      <div className="app-body">
        <aside className="sidebar">
          <ConnectionStatus status={connectionStatus} onRefresh={checkConnection} />
          <QuickActions onAction={sendMessage} disabled={isLoading || !connectionStatus.connected} />
          <CostTracker usage={totalUsage} />
        </aside>
        <main className="main-content">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
            onClear={clearChat}
            inputRef={inputRef}
          />
        </main>
      </div>
    </div>
  );
}
