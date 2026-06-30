import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/output", express.static(path.join(__dirname, "output")));

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

function obterRepresentanteDomum(representante) {
  if (representante === "jonatan") {
    return {
      nome: "Jonatan Patrick Rodrigues",
      registro: "178616/D",
      registroAssinatura: "CREA: 178616/D",
      cpf: ""
    };
  }

  return {
    nome: "Gustavo Akkari Madureira",
    registro: "178617/D",
    registroAssinatura: "CREA: 178617/D",
    cpf: ""
  };
}

function montarBlocoContratante(tipoContratante, contratante) {
  if (tipoContratante === "pessoa_juridica") {
    return [
      `Razão Social: ${contratante.razao_social || ""}`,
      `CNPJ: ${contratante.cnpj || ""}`,
      `Endereço: ${contratante.endereco || ""}`,
      `Representante Legal: ${contratante.representante_nome || ""}`,
      `CPF do Representante Legal: ${contratante.representante_cpf || ""}`,
      `Cargo/Função: ${contratante.representante_cargo || ""}`,
      `E-mail: ${contratante.email || ""}`,
      `Telefone: ${contratante.telefone || ""}`
    ].join("\n");
  }

  return [
    `Nome: ${contratante.nome || ""}`,
    `CPF: ${contratante.cpf || ""}`,
    `RG: ${contratante.rg || ""}`,
    `Profissão: ${contratante.profissao || ""}`,
    `Endereço: ${contratante.endereco || ""}`,
    `E-mail: ${contratante.email || ""}`,
    `Telefone: ${contratante.telefone || ""}`
  ].join("\n");
}

function montarDadosContrato(dados) {
  const representante = obterRepresentanteDomum(dados.representante_domum);
  const contratante = dados.contratante || {};

  const nomeExibicao =
    dados.tipo_contratante === "pessoa_juridica"
      ? contratante.razao_social || ""
      : contratante.nome || "";

  return {
    tipo_contrato: dados.tipo_contrato || "EMPREITADA PARCIAL",
    contratante_nome_exibicao: nomeExibicao.toUpperCase(),

    bloco_contratante: montarBlocoContratante(
      dados.tipo_contratante,
      contratante
    ),

    bloco_contratada: [
  "Empresa: RODRIGUES & MADUREIRA LTDA",
  "Nome fantasia: DOMUM ENGENHARIA",
  "CNPJ: 33.388.796/0001-50",
  "Endereço: Rua Santos Dumont, nº 3213, Sala 04, Maringá-PR, CEP 87013-050",
  "E-mail: domumenge@outlook.com",
  "Telefone: (44) 99136-5956",
  `Representante: ${representante.nome}`,
  `CREA: ${representante.registro}`
].join("\n"),

    clausula_objeto_conteudo:
      dados.clausula_objeto_conteudo ||
      "2.1. O objeto deste contrato será preenchido dinamicamente conforme os dados da obra.",

    clausula_documentos_tecnicos_conteudo:
      dados.clausula_documentos_tecnicos_conteudo ||
      "3.1. A execução da obra será realizada com base nos documentos técnicos informados e validados pelas partes.",

    clausula_servicos_contratados_conteudo:
      dados.clausula_servicos_contratados_conteudo ||
      "4.1. Os serviços contratados serão descritos dinamicamente conforme o escopo informado.",

    clausula_materiais_conteudo:
      dados.clausula_materiais_conteudo ||
      "5.1. A cláusula de materiais será definida conforme o tipo de contratação.",

    clausula_valores_pagamento_conteudo:
      dados.clausula_valores_pagamento_conteudo ||
      "6.1. Os valores e condições de pagamento serão preenchidos dinamicamente.",

    clausula_prazo_cronograma_conteudo:
      dados.clausula_prazo_cronograma_conteudo ||
      "7.1. O prazo e o cronograma serão definidos conforme as condições da obra.",

    clausula_obrigacoes_contratante_conteudo:
      dados.clausula_obrigacoes_contratante_conteudo ||
      "8.1. São obrigações do CONTRATANTE cumprir as condições previstas neste contrato.",

    clausula_obrigacoes_contratada_conteudo:
      dados.clausula_obrigacoes_contratada_conteudo ||
      "9.1. São obrigações da CONTRATADA executar os serviços conforme o escopo contratado.",

    clausula_rescisao_conteudo:
      dados.clausula_rescisao_conteudo ||
      "10.1. O contrato poderá ser rescindido conforme as hipóteses previstas neste instrumento.",

    clausula_multas_conteudo:
      dados.clausula_multas_conteudo ||
      "11.1. Aplicam-se as multas e encargos previstos neste contrato em caso de inadimplemento.",

    clausula_disposicoes_gerais_conteudo:
      dados.clausula_disposicoes_gerais_conteudo ||
      "12.1. Aplicam-se as disposições gerais previstas neste instrumento.",

    itens_nao_inclusos_formatados:
      dados.itens_nao_inclusos_formatados ||
      "13.1. Não estão inclusos no contrato itens não descritos expressamente no escopo contratado.",

    clausula_uso_imagem:
      dados.clausula_uso_imagem ||
      "14.1. A cláusula de uso de imagem será definida conforme autorização do CONTRATANTE.",

    clausula_foro_conteudo:
      dados.clausula_foro_conteudo ||
      "15.1. As partes elegem o foro da Comarca de Maringá/PR para dirimir eventuais controvérsias decorrentes deste contrato.",

    bloco_assinaturas:
      dados.bloco_assinaturas ||
      [
        "RODRIGUES & MADUREIRA LTDA",
        "CNPJ: 33.388.796/0001-50",
        "",
        "________________________________________",
        representante.nome,
        representante.registroAssinatura,
        "",
        "________________________________________",
        nomeExibicao,
        dados.tipo_contratante === "pessoa_juridica"
          ? `CNPJ: ${contratante.cnpj || ""}`
          : `CPF: ${contratante.cpf || ""}`
      ].join("\n")
  };
}

app.post("/gerar-contrato-empreitada", (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Acesso não autorizado."
      });
    }

    const dadosContrato = montarDadosContrato(req.body);

    const templatePath = path.join(
      __dirname,
      "templates",
      "modelo_contrato_de_obra_domum.docx"
    );

    const content = fs.readFileSync(templatePath, "binary");

    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: {
    start: "{{",
    end: "}}"
  }
});

    doc.render(dadosContrato);

    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE"
    });

    const nomeArquivo = `contrato_empreitada_${Date.now()}.docx`;
    const outputPath = path.join(__dirname, "output", nomeArquivo);

    fs.writeFileSync(outputPath, buffer);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return res.json({
      sucesso: true,
      mensagem: "Contrato DOCX gerado com sucesso.",
      arquivo_docx: `${baseUrl}/output/${nomeArquivo}`,
      nome_arquivo: nomeArquivo
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao gerar contrato.",
      erro: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API DOMUM rodando na porta ${PORT}`);
});
