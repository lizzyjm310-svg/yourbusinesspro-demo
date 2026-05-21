const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  if (!GROK_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with GROK_API_KEY.' });
  }

  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          {
            role: 'system',
            content: 'You are PRO, a friendly and professional AI assistant for Your Business PRO. You help small business owners who want to get more customers online. Ask smart qualifying questions, collect their name, phone, business type, and what service they need. Be helpful, clear, and focused on getting them results.'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Grok API error', detail: data });
    }

    return res.json(data);
  } catch (error) {
    console.error('Grok proxy error:', error);
    return res.status(500).json({ error: 'Unable to connect to Grok API.' });
  }
});

app.listen(PORT, () => {
  console.log(`Your Business PRO server running at http://localhost:${PORT}`);
});
