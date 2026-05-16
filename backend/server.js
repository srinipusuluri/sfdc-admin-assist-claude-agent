require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { chat } = require('./claude-agent');
const { testConnection } = require('./sfdc-client');

const app = express();
app.use(cors());
app.use(express.json());

// Conversation store (in-memory; keyed by session ID)
const sessions = {};

app.get('/api/status', async (req, res) => {
  try {
    const status = await testConnection();
    res.json(status);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  if (!sessions[sessionId]) sessions[sessionId] = [];
  sessions[sessionId].push({ role: 'user', content: message });

  try {
    const result = await chat(sessions[sessionId]);
    sessions[sessionId].push({ role: 'assistant', content: result.text });

    // Keep conversation history bounded
    if (sessions[sessionId].length > 40) {
      sessions[sessionId] = sessions[sessionId].slice(-40);
    }

    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    sessions[sessionId].pop(); // remove failed user message
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat/:sessionId', (req, res) => {
  delete sessions[req.params.sessionId];
  res.json({ cleared: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Salesforce Admin Assistant backend running on port ${PORT}`);
  console.log(`SF Login URL: ${process.env.SF_LOGIN_URL || 'https://login.salesforce.com'}`);
});
