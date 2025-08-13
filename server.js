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
    const { history, image } = req.body;

    if (!history) {
      return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
    }
    
    const lastUserTurn = history[history.length - 1];

    if (image) {
      const imageParts = image.split(',');
      if (imageParts.length !== 2) {
        return res.status(400).json({ error: 'Formato de imagem base64 inválido.' });
      }
      lastUserTurn.parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageParts[1]
        }
      });
    }
    
    const body = {
      contents: history
    };

    // <-- ALTERAÇÃO: O modelo da IA foi revertido para o original do seu arquivo.
    const modelToUse = 'gemini-2.5-flash-preview-05-20';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro da API Gemini:', errorData);
        throw new Error(errorData.error?.message || 'A API do Gemini retornou um erro.');
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui gerar uma resposta.";
    
    res.json({ reply });

  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao gerar resposta.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
