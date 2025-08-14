import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurações da API e Retentativa via .env ---
const API_KEY = process.env.GEMINI_API_KEY;
const API_MODEL = 'gemini-2.5-flash-preview-05-20';
// Converte as variáveis de ambiente para números, com valores padrão seguros
const MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 3;
const BACKOFF_BASE_MS = parseInt(process.env.GEMINI_BACKOFF_BASE_MS, 10) || 300;

if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Rotas de Monitoramento ---

// Rota para o "cold start" inicial do Render
app.get('/health', (req, res) => {
    console.log("Servidor recebeu um ping 'health'. Status: Saudável.");
    res.status(200).send('Server is healthy and running.');
});

// Rota para o front-end manter o servidor "acordado" periodicamente
app.get('/wake', (req, res) => {
    console.log("Servidor recebeu um ping 'wake'. Hibernação evitada.");
    res.status(200).json({ status: 'awake' });
});


// --- Rotas da API Gemini ---

// Rota para a conversa principal com lógica de resiliência
app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body = { contents: history };
      const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000) // Timeout de 20 segundos
      });

      if (!apiResponse.ok) {
        // Lança um erro para ser pego pelo catch e acionar a retentativa
        const errorData = await apiResponse.json();
        throw new Error(errorData.error?.message || `API Error: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      // Tratamento para resposta vazia, mas com status 200 OK
      if (!reply) {
        throw new Error("A API retornou uma resposta vazia.");
      }
      
      console.log(`[Sucesso] Resposta da API recebida na tentativa ${attempt}.`);
      return res.json({ reply }); // Sucesso, retorna a resposta e encerra

    } catch (error) {
      lastError = error;
      // [LOG DIFERENCIADO] Usa console.warn para erros intermediários
      console.warn(`[AVISO] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${error.message}`);
      
      if (attempt < MAX_RETRIES) {
        // Backoff exponencial com base configurável
        const delay = Math.pow(2, attempt - 1) * BACKOFF_BASE_MS;
        console.log(`Aguardando ${delay}ms para a próxima tentativa.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // [LOG DIFERENCIADO] Usa console.error para a falha final
  console.error(`[ERRO] Todas as ${MAX_RETRIES} tentativas de chamar a API falharam.`, lastError);
  res.status(503).json({ error: `O modelo de IA parece estar sobrecarregado. Por favor, tente novamente em alguns instantes.` });
});

// Rota para gerar títulos (sem a complexa lógica de retentativa, pois é menos crítica)
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
        console.error('[ERRO] Falha ao gerar título:', error);
        res.status(500).json({ title: "Nova Conversa" });
    }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} com até ${MAX_RETRIES} tentativas para a API.`);
});

