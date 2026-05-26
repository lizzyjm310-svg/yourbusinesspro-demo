require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const DEFAULT_SYSTEM_PROMPT = `You are PRO, the friendly and professional AI lead-capture assistant for Your Business PRO. Your audience is small local business owners with little or no online presence. Your goal is to qualify motivated business owners by asking one or two natural questions at a time, then summarize the lead clearly for Elizabeth.

Ask for the business name early, then ask which main service they want in plain language: Website, Google/Facebook setup, Lead generation, Full system, or Free Online Presence Review/Audit.

If they mention a review, audit, or online presence check, specifically collect the following details:
- Business name
- Current website URL, if any
- Facebook page URL, if any
- Google Business Profile name or location
- Phone number
- Their name

Also gather any details that help Elizabeth look up their business online (review listings, website, Facebook, or Google presence) without making the conversation feel like a form.

If the lead is unsure, offer the service options gently and help them choose the best fit. Do not overwhelm them with too many questions at once. Avoid pricing or hard sales claims.

Once you have the business name and contact information, summarize the lead warmly and say: "I'll pass this over to Elizabeth so she can prepare a custom review for you."`;

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Optional integrations
let sgMail = null;
let twilioClient = null;
if (SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
  } catch (e) {
    console.warn('SendGrid module not available or not installed. Email notifications disabled.');
  }
}
if (TWILIO_SID && TWILIO_TOKEN) {
  try {
    const Twilio = require('twilio');
    twilioClient = new Twilio(TWILIO_SID, TWILIO_TOKEN);
  } catch (e) {
    console.warn('Twilio module not available or not installed. SMS notifications disabled.');
  }
}

app.post('/api/chat', async (req, res) => {
  if (!GROK_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with GROK_API_KEY.' });
  }

  const { systemPrompt, messages, message } = req.body;
  const userText = typeof message === 'string' ? message.trim()
    : Array.isArray(messages)
      ? messages.filter(m => m.role === 'user' && typeof m.content === 'string').map(m => m.content.trim()).find(Boolean)
      : undefined;

  if (!userText) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const prompt = typeof systemPrompt === 'string' && systemPrompt.trim().length > 0
    ? systemPrompt.trim()
    : DEFAULT_SYSTEM_PROMPT;

  const chatMessages = Array.isArray(messages)
    ? [...messages]
    : [{ role: 'user', content: message }];

  if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
    chatMessages.unshift({ role: 'system', content: prompt });
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
        messages: chatMessages,
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

// Lead capture endpoint: save lead, notify via SendGrid and Twilio when configured
app.post('/api/lead', async (req, res) => {
  const { name, business, phone, email, website, service, page } = req.body || {};
  if (!name && !phone && !email) {
    return res.status(400).json({ error: 'Provide at least a name and phone or email.' });
  }

  const lead = {
    id: Date.now(),
    name: name || '',
    business: business || '',
    phone: phone || '',
    email: email || '',
    website: website || '',
    service: service || '',
    page: page || '',
    createdAt: new Date().toISOString()
  };

  // persist to leads.json (simple demo store)
  const leadsFile = path.join(__dirname, 'leads.json');
  try {
    let leads = [];
    if (fs.existsSync(leadsFile)) {
      const raw = fs.readFileSync(leadsFile, 'utf8');
      leads = raw ? JSON.parse(raw) : [];
    }
    leads.push(lead);
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
  } catch (err) {
    console.error('Failed to persist lead:', err);
  }

  // Send email notification via SendGrid
  try {
    if (sgMail && SENDGRID_FROM) {
      const to = process.env.LEAD_NOTIFY_TO || SENDGRID_FROM;
      const subject = `New lead from ${lead.page || 'website'}`;
      const text = `New lead:\n\nName: ${lead.name}\nBusiness: ${lead.business}\nPhone: ${lead.phone}\nEmail: ${lead.email}\nWebsite: ${lead.website}\nService: ${lead.service}\nPage: ${lead.page}`;
      await sgMail.send({ to, from: SENDGRID_FROM, subject, text, html: text.replace(/\n/g, '<br>') });
    }
  } catch (err) {
    console.error('SendGrid send error:', err?.message || err);
  }

  // Send SMS notification via Twilio
  try {
    if (twilioClient && TWILIO_FROM && process.env.TWILIO_NOTIFY_TO) {
      const body = `New lead: ${lead.name} ${lead.phone || lead.email} - ${lead.service || lead.business}`;
      await twilioClient.messages.create({ body, from: TWILIO_FROM, to: process.env.TWILIO_NOTIFY_TO });
    }
  } catch (err) {
    console.error('Twilio send error:', err?.message || err);
  }

  return res.json({ success: true, lead });
});

app.listen(PORT, () => {
  console.log(`Your Business PRO server running at http://localhost:${PORT}`);
});
