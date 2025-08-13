// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const API_MODEL = 'gemini-1.5-flash-latest'; // Modelo centralizado

if (!API_KEY) {
  console.error('Erro: variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rota para a conversa principal
app.post('/api/generate', async (req, res) => {
  try {
    const { history } = req.body;
    if (!history) {
      return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
    }
    
    const body = { contents: history };
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error?.message || 'A API do Gemini retornou um erro.');
    }

    const data = await apiResponse.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui gerar uma resposta.";
    res.json({ reply });

  } catch (error) {
    console.error('Erro em /api/generate:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao gerar resposta.' });
  }
});

// CORREÇÃO: Nova rota para gerar títulos inteligentes
app.post('/api/generate-title', async (req, res) => {
    try {
        const { userMessage } = req.body;
        if (!userMessage) {
            return res.status(400).json({ error: 'Mensagem do usuário é obrigatória.'});
        }

        const titlePrompt = `Você é um assistente que cria títulos curtos e amigáveis para conversas de chat. Crie um título com no máximo 5 palavras para a seguinte pergunta de um usuário. Responda apenas com o título, sem aspas e sem texto adicional. PERGUNTA: "${userMessage}"`;
        const body = {
            contents: [{ parts: [{ text: titlePrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 20 }
        };

        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(errorData.error?.message || 'A API do Gemini retornou um erro ao gerar título.');
        }
        
        const data = await apiResponse.json();
        const title = data.candidates?.[0]?.content?.parts?.[0]?.text.trim().replace(/"/g, '') || "Nova Conversa";
        res.json({ title });

    } catch (error) {
        console.error('Erro em /api/generate-title:', error);
        res.status(500).json({ title: "Nova Conversa" }); // Retorna um título padrão em caso de erro
    }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
