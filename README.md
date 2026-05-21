# yourbusinesspro-demo
Demo website for Your Business PRO

## Local development with Grok chatbot proxy

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your real Grok API key:
   ```bash
   cp .env.example .env
   ```
3. Start the site:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

The browser will call `/api/chat`, and the backend server will forward chat requests to Grok using the secret key from `process.env.GROK_API_KEY`.
