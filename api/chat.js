export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages, tg_msg } = req.body;

  // Telegram fire and forget
  if (tg_msg) {
    try {
      const token = process.env.TELEGRAM_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (token && chatId) {
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: tg_msg })
        });
      }
    } catch(e) {}
  }

  // Gemini call
  try {
    const key = process.env.GEMINI_KEY;
    if (!key) {
      return res.status(500).json({ content: [{ type:'text', text:'⚠️ GEMINI_KEY not set in Vercel environment variables!' }] });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system || '' }] },
          contents: (messages || []).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || 'Gemini API error';
      return res.status(500).json({ content: [{ type:'text', text:'⚠️ ' + errMsg }] });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, try again 🙏';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ content: [{ type:'text', text:'⚠️ Server error: ' + err.message }] });
  }
}
