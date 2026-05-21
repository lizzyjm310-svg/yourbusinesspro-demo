require('dotenv').config();
const express = require('express');
const path = require('path');

const DEFAULT_SYSTEM_PROMPT = `You are PRO, a professional, friendly AI assistant for Your Business PRO. Your audience is small local business owners with little or no online presence. Your focus is to help them get a professional website, a strong Google Business Profile, a Facebook page, and more leads. Ask one or two clear qualifying questions at a time. Collect the following details naturally: full name, business name, phone number, current website (if any), business type / industry, and the service they need most right now. Once you have name, business name, phone number, and main need, summarize the lead and say you will notify the team. Keep the tone warm, professional, and helpful.`;

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  if (!GROK_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with GROK_API_KEY.' });
  }

  const { systemPrompt, message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const prompt = typeof systemPrompt === 'string' && systemPrompt.trim().length > 0
    ? systemPrompt.trim()
    : DEFAULT_SYSTEM_PROMPT;

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
          { role: 'system', content: prompt },
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
