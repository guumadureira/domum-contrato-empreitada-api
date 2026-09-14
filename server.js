import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

dotenv.config();

const execFileAsync = promisify(execFile);

const app = express();
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "output");

fs.mkdirSync(outputDir, { recursive: true });

app.use("/output", express.static(outputDir));

app.get("/", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "API DOMUM - Contrato de Empreitada V2 ativa."
  });
});

app.get("/status", (req, res) => {
  res.json({
    sucesso: true,
    status: "online",
    servico: "domum-contrato-empreitada-api",
    versao: "2.0.0"
  });
});

function texto(valor, fallback = "") {
  if (valor === undefined || valor === null) return fallback;
  return String(valor).trim();
}

function tem(valor) {
  return texto(valor) !== "";
}

function obterDataContrato(dataInformada) {
  if (tem(dataInformada)) {
    return texto(dataInformada);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function montarLocalData(localContrato, dataContrato) {
  const local = texto(localContrato, "Maringá/PR");
  const data = obterDataContrato(dataContrato);

  return `${local}, ${data}.`;
}

function montarBlocoContratante(tipoContratante, contratante) {
  if (tipoContratante === "pessoa_juridica") {
    return [
      `Razão Social: ${texto(contratante.razao_social)}`,
      `CNPJ: ${texto(contratante.cnpj)}`,
      `Endereço: ${texto(contratante.endereco)}`,
      `Representante Legal: ${texto(contratante.representante_nome)}`,
      `CPF do Representante Legal: ${texto(
        contratante.representante_cpf
      )}`,
      `Cargo/Função: ${texto(contratante.representante_cargo)}`,
      `E-mail: ${texto(contratante.email)}`,
      `Telefone: ${texto(contratante.telefone)}`
    ].join("\n");
  }

  return [
    `Nome: ${texto(contratante.nome)}`,
    `CPF: ${texto(contratante.cpf)}`,
    `RG: ${texto(contratante.rg)}`,
    `Profissão: ${texto(contratante.profissao)}`,
    `Endereço: ${texto(contratante.endereco)}`,
    `E-mail: ${texto(contratante.email)}`,
    `Telefone: ${texto(contratante.telefone)}`
  ].join("\n");
}

function montarBlocoContratada(representante) {
  const linhas = [
    "Empresa: RODRIGUES & MADUREIRA LTDA",
    "Nome fantasia: DOMUM ENGENHARIA",
    "CNPJ: 33.388.796/0001-50",
    "Endereço: Rua Santos Dumont, nº 3213, Sala 04, Maringá-PR, CEP 87013-050",
    "E-mail: domumenge@outlook.com",
    "Telefone: (44) 99136-5956",
    `Representante: ${texto(representante.nome)}`,
    `CREA: ${texto(representante.crea)}`
  ];

  if (tem(representante.cpf)) {
    linhas.push(`CPF: ${texto(representante.cpf)}`);
  }

  return linhas.join("\n");
}

function numeroPorExtenso(numero) {
  const nomes = {
    1: "PRIMEIRA",
    2: "SEGUNDA",
    3: "TERCEIRA",
    4: "QUARTA",
    5: "QUINTA",
    6: "SEXTA",
    7: "SÉTIMA",
    8: "OITAVA",
    9: "NONA",
    10: "DÉCIMA",
    11: "DÉCIMA PRIMEIRA",
    12: "DÉCIMA SEGUNDA",
    13: "DÉCIMA TERCEIRA",
    14: "DÉCIMA QUARTA",
    15: "DÉCIMA QUINTA",
    16: "DÉCIMA SEXTA",
    17: "DÉCIMA SÉTIMA",
    18: "DÉCIMA OITAVA",
    19: "DÉCIMA NONA",
    20: "VIGÉSIMA"
  };

  return nomes[numero] || String(numero);
}

function montarClausulasLivres(clausulas) {
  if (!Array.isArray(clausulas) || clausulas.length === 0) {
    return "";
  }

  return clausulas
    .map((clausula, indiceClausula) => {
      const numeroClausula = indiceClausula + 1;
      const titulo = texto(clausula.titulo).toUpperCase();
      const blocos = Array.isArray(clausula.blocos)
        ? clausula.blocos
        : [];

      const partes = [];

      partes.push(
        `CLÁUSULA ${numeroPorExtenso(numeroClausula)} – ${titulo}`
      );

      let numeroParagrafo = 1;

      for (const bloco of blocos) {
        if (!bloco || !bloco.tipo) {
          continue;
        }

        if (bloco.tipo === "paragrafo") {
          const conteudo = texto(bloco.texto);

          if (!conteudo) {
            continue;
          }

          partes.push(
            `${numeroClausula}.${numeroParagrafo}. ${conteudo}`
          );

          numeroParagrafo++;
        }

        if (bloco.tipo === "lista") {
          const itens = Array.isArray(bloco.itens)
            ? bloco.itens
                .map((item) => texto(item))
                .filter(Boolean)
            : [];

          itens.forEach((item, indiceItem) => {
            const letra = String.fromCharCode(97 + indiceItem);

            partes.push(`${letra}) ${item}`);
          });
        }
      }

      return partes.join("\n\n");
    })
    .join("\n\n");
}

function montarBlocoAssinaturas(dados, representante) {
  const contratante = dados.contratante || {};

  const linhas = [
    "________________________________________",
    "RODRIGUES & MADUREIRA LTDA",
    "CNPJ: 33.388.796/0001-50",
    texto(representante.nome)
  ];

  if (tem(representante.cpf)) {
    linhas.push(`CPF: ${texto(representante.cpf)}`);
  }

  linhas.push(`CREA: ${texto(representante.crea)}`);
  linhas.push("");

  if (dados.tipo_contratante === "pessoa_juridica") {
    linhas.push("________________________________________");
    linhas.push(texto(contratante.razao_social));
    linhas.push(`CNPJ: ${texto(contratante.cnpj)}`);
    linhas.push(texto(contratante.representante_nome));
    linhas.push(`CPF: ${texto(contratante.representante_cpf)}`);
    linhas.push(texto(contratante.representante_cargo));
  } else {
    linhas.push("________________________________________");
    linhas.push(texto(contratante.nome));
    linhas.push(`CPF: ${texto(contratante.cpf)}`);
  }

  if (
    dados.possui_testemunhas === true &&
    Array.isArray(dados.testemunhas) &&
    dados.testemunhas.length > 0
  ) {
    linhas.push("");
    linhas.push("TESTEMUNHAS");
    linhas.push("");

    dados.testemunhas.slice(0, 2).forEach((testemunha, index) => {
      linhas.push(`Testemunha ${index + 1}:`);
      linhas.push("");
      linhas.push("________________________________________");
      linhas.push(`Nome: ${texto(testemunha.nome)}`);
      linhas.push(`CPF: ${texto(testemunha.cpf)}`);
      linhas.push("");
    });
  }

  return linhas.join("\n");
}

function montarDadosContrato(dados) {
  const contratante = dados.contratante || {};
  const representante = dados.representante_domum || {};

  const nomeExibicao =
    dados.tipo_contratante === "pessoa_juridica"
      ? texto(contratante.razao_social)
      : texto(contratante.nome);

  return {
    titulo_contrato: texto(
      dados.titulo_contrato,
      `CONTRATO DE ${texto(
        dados.tipo_contrato,
        "EMPREITADA PARCIAL"
      )}`
    ),

    contratante_nome_exibicao: nomeExibicao.toUpperCase(),

    bloco_contratante: montarBlocoContratante(
      dados.tipo_contratante,
      contratante
    ),

    bloco_contratada: montarBlocoContratada(representante),

    clausulas_conteudo: montarClausulasLivres(
      dados.clausulas
    ),

    fecho: texto(
      dados.fecho,
      "E, por estarem de acordo, as partes assinam o presente contrato."
    ),

    local_data: montarLocalData(
      dados.local_contrato,
      dados.data_contrato
    ),

    bloco_assinaturas: montarBlocoAssinaturas(
      dados,
      representante
    )
  };
}

function validarDadosBasicos(dados) {
  const erros = [];

  if (
    !["EMPREITADA PARCIAL", "EMPREITADA GLOBAL"].includes(
      texto(dados.tipo_contrato)
    )
  ) {
    erros.push(
      "tipo_contrato deve ser EMPREITADA PARCIAL ou EMPREITADA GLOBAL."
    );
  }

  if (
    !["pessoa_fisica", "pessoa_juridica"].includes(
      texto(dados.tipo_contratante)
    )
  ) {
    erros.push(
      "tipo_contratante deve ser pessoa_fisica ou pessoa_juridica."
    );
  }

  if (!tem(dados.titulo_contrato)) {
    erros.push("titulo_contrato é obrigatório.");
  }

  if (!dados.contratante) {
    erros.push("Dados do contratante são obrigatórios.");
  }

  if (dados.tipo_contratante === "pessoa_fisica") {
    if (!tem(dados.contratante?.nome)) {
      erros.push("Nome do contratante é obrigatório.");
    }
  }

  if (dados.tipo_contratante === "pessoa_juridica") {
    if (!tem(dados.contratante?.razao_social)) {
      erros.push("Razão social do contratante é obrigatória.");
    }
  }

  if (
    !dados.representante_domum ||
    !tem(dados.representante_domum.nome) ||
    !tem(dados.representante_domum.crea)
  ) {
    erros.push(
      "representante_domum deve conter nome e crea."
    );
  }

  if (
    !Array.isArray(dados.clausulas) ||
    dados.clausulas.length === 0
  ) {
    erros.push("Ao menos uma cláusula é obrigatória.");
  }

  if (Array.isArray(dados.clausulas)) {
    dados.clausulas.forEach((clausula, indice) => {
      if (!tem(clausula?.titulo)) {
        erros.push(
          `Título da cláusula ${indice + 1} é obrigatório.`
        );
      }

      if (
        !Array.isArray(clausula?.blocos) ||
        clausula.blocos.length === 0
      ) {
        erros.push(
          `A cláusula ${indice + 1} deve possuir ao menos um bloco.`
        );
      }
    });
  }

  if (dados.possui_testemunhas === true) {
    if (
      !Array.isArray(dados.testemunhas) ||
      dados.testemunhas.length < 2
    ) {
      erros.push(
        "Quando possui_testemunhas = true, devem ser informadas duas testemunhas."
      );
    }
  }

  if (erros.length > 0) {
    const erro = new Error(erros.join(" "));
    erro.statusCode = 400;
    throw erro;
  }
}

function renderizarDocx(dadosContrato) {
  const templatePath = path.join(
    __dirname,
    "templates",
    "modelo_contrato_de_obra_domum_v2.docx"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      "Template modelo_contrato_de_obra_domum_v2.docx não encontrado."
    );
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,

    delimiters: {
      start: "{{",
      end: "}}"
    },

    nullGetter: () => ""
  });

  doc.render(dadosContrato);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE"
  });
}

function verificarDocxFinal(buffer) {
  const zip = new PizZip(buffer);

  let xml = "";

  Object.keys(zip.files).forEach((nomeArquivo) => {
    if (
      nomeArquivo.startsWith("word/") &&
      nomeArquivo.endsWith(".xml")
    ) {
      xml += zip.file(nomeArquivo)?.asText() || "";
    }
  });

  if (xml.includes("{{") || xml.includes("}}")) {
    throw new Error(
      "O documento final ainda possui placeholders não preenchidos."
    );
  }

  if (xml.includes("undefined")) {
    throw new Error(
      "O documento final possui algum campo com valor undefined."
    );
  }
}

async function converterDocxParaPdf(
  docxPath,
  outputDir
) {
  const comandos = [
    "libreoffice",
    "soffice"
  ];

  const erros = [];

  for (const comando of comandos) {
    try {
      await execFileAsync(
        comando,
        [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          outputDir,
          docxPath
        ],
        {
          timeout: 120000,

          env: {
            ...process.env,
            HOME: "/tmp"
          }
        }
      );

      const nomePdf =
        `${path.basename(docxPath, ".docx")}.pdf`;

      const pdfPath =
        path.join(outputDir, nomePdf);

      if (fs.existsSync(pdfPath)) {
        return pdfPath;
      }
    } catch (error) {
      erros.push(
        `${comando}: ${error.message}`
      );
    }
  }

  throw new Error(
    `Falha ao converter DOCX para PDF. ${erros.join(" | ")}`
  );
}

function nomeArquivoSeguro(dados) {
  const contratante =
    dados.contratante || {};

  const nome =
    dados.tipo_contratante === "pessoa_juridica"
      ? texto(
          contratante.razao_social,
          "contratante"
        )
      : texto(
          contratante.nome,
          "contratante"
        );

  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return `contrato_empreitada_${
    limpo || "contratante"
  }_${Date.now()}`;
}

function validarAutenticacao(req, res) {
  const apiKeyEsperada =
    String(
      process.env.API_KEY || ""
    ).trim();

  if (!apiKeyEsperada) {
    res.status(500).json({
      sucesso: false,
      mensagem:
        "API_KEY não configurada no servidor."
    });

    return false;
  }

  const chaveHeader =
    String(
      req.headers["x-api-key"] || ""
    ).trim();

  const authorization =
    String(
      req.headers["authorization"] || ""
    ).trim();

  const chaveBearer =
    authorization
      .toLowerCase()
      .startsWith("bearer ")
      ? authorization
          .slice(7)
          .trim()
      : "";

  const apiKeyRecebida =
    chaveHeader || chaveBearer;

  if (
    apiKeyRecebida !==
    apiKeyEsperada
  ) {
    res.status(401).json({
      sucesso: false,
      mensagem:
        "Acesso não autorizado."
    });

    return false;
  }

  return true;
}

app.post(
  "/gerar-contrato-empreitada",
  async (req, res) => {
    try {
      if (
        !validarAutenticacao(
          req,
          res
        )
      ) {
        return;
      }

      const dados =
        req.body || {};

      validarDadosBasicos(dados);

      const dadosContrato =
        montarDadosContrato(dados);

      const bufferDocx =
        renderizarDocx(
          dadosContrato
        );

      verificarDocxFinal(
        bufferDocx
      );

      const nomeBase =
        nomeArquivoSeguro(
          dados
        );

      const docxPath =
        path.join(
          outputDir,
          `${nomeBase}.docx`
        );

      fs.writeFileSync(
        docxPath,
        bufferDocx
      );

      const pdfPath =
        await converterDocxParaPdf(
          docxPath,
          outputDir
        );

      const baseUrl =
        process.env.PUBLIC_BASE_URL ||
        `${req.protocol}://${req.get(
          "host"
        )}`;

      return res.json({
        sucesso: true,

        mensagem:
          "Contrato de empreitada gerado com sucesso.",

        arquivos: {
          pdf: {
            url:
              `${baseUrl}/output/${path.basename(
                pdfPath
              )}`,

            nome:
              path.basename(
                pdfPath
              )
          },

          docx: {
            url:
              `${baseUrl}/output/${path.basename(
                docxPath
              )}`,

            nome:
              path.basename(
                docxPath
              )
          }
        }
      });
    } catch (error) {
      console.error(error);

      return res
        .status(
          error.statusCode || 500
        )
        .json({
          sucesso: false,

          mensagem:
            "Erro ao gerar contrato de empreitada.",

          erro:
            error.message
        });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `API DOMUM V2 rodando na porta ${PORT}`
  );
});
