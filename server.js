import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "API DOMUM - Contrato de Empreitada ativa."
  });
});

app.get("/status", (req, res) => {
  res.json({
    sucesso: true,
    status: "online",
    servico: "domum-contrato-empreitada-api"
  });
});

app.post("/gerar-contrato-empreitada", (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Acesso não autorizado."
    });
  }

  const dados = req.body;

  return res.json({
    sucesso: true,
    mensagem: "Endpoint de contrato de empreitada recebido com sucesso. Geração de PDF ainda será implementada.",
    dados_recebidos: dados
  });
});

app.listen(PORT, () => {
  console.log(`API DOMUM rodando na porta ${PORT}`);
});
