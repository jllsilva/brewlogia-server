// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('Erro: variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, imageBase64, beerXmlText } = req.body;

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...(imageBase64 ? [{ inline_data: { mime_type: 'image/png', data: imageBase64.split(',')[1] } }] : []),
          ...(beerXmlText ? [{ text: beerXmlText }] : [])
        ]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar resposta.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});