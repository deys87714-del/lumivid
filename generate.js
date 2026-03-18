export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured. Add REPLICATE_API_TOKEN in Vercel environment variables.' });

  const { image, prompt, model, duration, aspect_ratio } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Step 1: Upload image to Replicate file storage
    const imageData = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(imageData, 'base64');
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const uploadRes = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': mimeType,
        'Content-Length': imageBuffer.length,
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(500).json({ error: `Image upload failed: ${err}` });
    }

    const uploadedFile = await uploadRes.json();
    const imageUrl = uploadedFile.urls?.get || uploadedFile.url;

    // Step 2: Choose model based on selected panel
    // Kling → klingai/kling-1.6-standard-i2v
    // Veo   → minimax/video-01-live (best free alternative)
    let predictionBody;

    if (model === 'kling') {
      predictionBody = {
        version: null,
        input: {
          image: imageUrl,
          prompt: prompt || 'Smooth natural motion, cinematic',
          duration: duration === '1 min' ? 10 : duration === '10s' ? 10 : 5,
          aspect_ratio: aspect_ratio || '16:9',
          cfg_scale: 0.5,
          negative_prompt: 'blur, distortion, bad quality',
        }
      };
      // Use Kling 1.6 standard image-to-video
      const predRes = await fetch('https://api.replicate.com/v1/models/klingai/kling-1.6-standard-i2v/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=5',
        },
        body: JSON.stringify(predictionBody),
      });
      const prediction = await predRes.json();
      return res.status(200).json({ id: prediction.id, status: prediction.status, error: prediction.error });

    } else {
      // Veo panel → use minimax/video-01-live
      predictionBody = {
        input: {
          first_frame_image: imageUrl,
          prompt: prompt || 'Cinematic video, smooth motion, photorealistic',
        }
      };
      const predRes = await fetch('https://api.replicate.com/v1/models/minimax/video-01-live/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=5',
        },
        body: JSON.stringify(predictionBody),
      });
      const prediction = await predRes.json();
      return res.status(200).json({ id: prediction.id, status: prediction.status, error: prediction.error });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
