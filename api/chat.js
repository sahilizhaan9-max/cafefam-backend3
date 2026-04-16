
// api/chat.js — Vercel Serverless Function
// Handles: Gemini AI chat + Telegram notification

export default async function handler(req, res) {
  // CORS — allow any origin (Netlify frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages, tg_msg } = req.body;

  // ── Telegram notification (fire and forget) ──
  if (tg_msg) {
    sendTelegram(tg_msg).catch(() => {});
  }

  // ── Gemini API call ──
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: data.error || { message: 'Gemini error' } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, try again 🙏';

    // Return in Anthropic-compatible format (frontend expects this)
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Gemini error:', err);
    return res.status(500).json({ error: { message: 'Server error, try again!' } });
  }
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  });
}
