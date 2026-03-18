export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'No prediction ID' });

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const data = await response.json();
    return res.status(200).json({
      id: data.id,
      status: data.status,
      output: data.output,
      error: data.error,
      logs: data.logs,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
