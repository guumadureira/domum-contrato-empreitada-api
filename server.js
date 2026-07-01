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
const tempDir = path.join(__dirname, "tmp");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

app.use("/output", express.static(outputDir));

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

function texto(valor, fallback = "") {
  if (valor === undefined || valor === null) return fallback;
  return String(valor).trim();
}

function tem(valor) {
  return texto(valor) !== "";
}

function lista(valor) {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => texto(item)).filter(Boolean);
}

function formatarLista(itens, fallback = "- Nenhum item específico informado.") {
  const listaFinal = lista(itens);
  if (listaFinal.length === 0) return fallback;
  return listaFinal.map((item) => `- ${item};`).join("\n");
}

function obterDataContrato(dataInformada) {
  if (tem(dataInformada)) return texto(dataInformada);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function obterRepresentanteDomum(representante, cpfInformado = "") {
  if (representante === "jonatan") {
    return {
      nome: "Jonatan Patrick Rodrigues",
      registro: "178616/D",
      registroAssinatura: "CREA: 178616/D",
      cpf: texto(cpfInformado)
    };
  }

  return {
    nome: "Gustavo Akkari Madureira",
    registro: "178617/D",
    registroAssinatura: "CREA: 178617/D",
    cpf: texto(cpfInformado)
  };
}

function montarBlocoContratante(tipoContratante, contratante) {
  if (tipoContratante === "pessoa_juridica") {
    return [
      `Razão Social: ${texto(contratante.razao_social)}`,
      `CNPJ: ${texto(contratante.cnpj)}`,
      `Endereço: ${texto(contratante.endereco)}`,
      `Representante Legal: ${texto(contratante.representante_nome)}`,
      `CPF do Representante Legal: ${texto(contratante.representante_cpf)}`,
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
  return [
    "Empresa: RODRIGUES & MADUREIRA LTDA",
    "Nome fantasia: DOMUM ENGENHARIA",
    "CNPJ: 33.388.796/0001-50",
    "Endereço: Rua Santos Dumont, nº 3213, Sala 04, Maringá-PR, CEP 87013-050",
    "E-mail: domumenge@outlook.com",
    "Telefone: (44) 99136-5956",
    `Representante: ${representante.nome}`,
    `CREA: ${representante.registro}`
  ].join("\n");
}

function montarClausulaObjeto(dados) {
  const obra = dados.obra || {};
  const tipoContrato = texto(dados.tipo_contrato, "EMPREITADA PARCIAL").toLowerCase();

  const linhas = [];

  linhas.push(
    `2.1. O objeto deste contrato é a execução, em regime de ${tipoContrato}, de ${texto(
      obra.descricao_obra,
      "obra conforme escopo contratado"
    )}, a ser realizada no endereço ${texto(
      obra.endereco_obra,
      "não informado"
    )}, conforme escopo de serviços descrito neste instrumento.`
  );

  let item = 2;

  if (tem(obra.area_aproximada)) {
    linhas.push(
      `2.${item}. A obra possui área aproximada de ${texto(
        obra.area_aproximada
      )}, conforme informações fornecidas pelo CONTRATANTE e/ou documentos técnicos de referência vinculados à contratação.`
    );
    item++;
  }

  if (tem(obra.documentos_referencia)) {
    linhas.push(
      `2.${item}. Integram este contrato, para todos os fins, os documentos técnicos, memoriais, orçamentos, propostas comerciais, cronogramas, plantas, projetos e demais anexos expressamente indicados pelas partes, especialmente: ${texto(
        obra.documentos_referencia
      )}.`
    );
  }

  return linhas.join("\n\n");
}

function montarClausulaDocumentosTecnicos(dados, representante) {
  const documentos = dados.documentos_tecnicos || {};
  const origem = texto(documentos.origem, "escopo_sem_projeto_executivo");

  if (origem === "domum") {
    const responsavelNome =
      texto(documentos.responsavel_tecnico_nome) || representante.nome;
    const responsavelCrea =
      texto(documentos.responsavel_tecnico_crea) || representante.registro;

    return [
      `3.1. A execução da obra será realizada com base nos projetos, memoriais, detalhamentos e demais documentos técnicos elaborados pela CONTRATADA, por meio do profissional ${responsavelNome}, inscrito no CREA sob nº ${responsavelCrea}, observadas as condições, limitações e especificações previstas neste contrato e em seus anexos.`,
      "3.2. Caso sejam identificadas, durante a execução, necessidades de ajustes, compatibilizações ou alterações técnicas, estas deverão ser previamente comunicadas ao CONTRATANTE, podendo ensejar revisão de prazo, valor, escopo ou formalização de aditivo contratual, quando aplicável."
    ].join("\n\n");
  }

  if (origem === "terceiro") {
    return [
      "3.1. A execução da obra será realizada com base nos projetos, memoriais, detalhamentos e demais documentos técnicos fornecidos pelo CONTRATANTE, cuja autoria, compatibilização, aprovação, responsabilidade técnica e conformidade legal permanecem vinculadas aos respectivos profissionais responsáveis.",
      "3.2. A CONTRATADA não se responsabiliza por erros, omissões, incompatibilidades, divergências ou insuficiências constantes em projetos ou documentos técnicos elaborados por terceiros, salvo quando tais situações forem previamente identificadas e expressamente assumidas pela CONTRATADA por meio de aditivo contratual.",
      "3.3. Caso sejam identificadas, durante a execução, necessidades de ajustes, compatibilizações ou alterações técnicas, estas deverão ser previamente comunicadas ao CONTRATANTE, podendo ensejar revisão de prazo, valor, escopo ou formalização de aditivo contratual, quando aplicável."
    ].join("\n\n");
  }

  return [
    "3.1. A execução da obra será realizada com base no escopo técnico, orçamento, proposta comercial, memorial descritivo, levantamento, orientações e demais documentos validados pelas partes, os quais definem os serviços contratados, suas limitações e condições de execução.",
    "3.2. Na ausência de projeto executivo completo, a execução ficará limitada ao escopo expressamente contratado. Caso sejam identificadas necessidades técnicas não previstas inicialmente, estas deverão ser previamente comunicadas ao CONTRATANTE e poderão ensejar orçamento complementar, revisão de prazo, revisão de valor ou formalização de aditivo contratual.",
    "3.3. A CONTRATADA não se responsabiliza por definições, aprovações, compatibilizações ou responsabilidades técnicas que não tenham sido expressamente assumidas neste contrato ou em seus anexos."
  ].join("\n\n");
}

function montarClausulaServicos(dados) {
  const inclusos = lista(dados.servicos_inclusos);

  const linhas = [
    "4.1. A CONTRATADA prestará os serviços necessários à execução do escopo contratado, observadas as condições previstas neste instrumento, nos documentos técnicos de referência, na proposta comercial, no orçamento, no memorial descritivo e/ou nos anexos vinculados ao presente contrato, quando houver.",
    "4.2. Os serviços contratados compreendem a organização, coordenação e execução das etapas expressamente descritas neste contrato, limitando-se ao escopo aprovado entre as partes.",
    "4.3. A CONTRATADA poderá realizar análise prévia do local da obra, das condições existentes, dos acessos, das interferências físicas, das instalações disponíveis e demais fatores que possam impactar a execução dos serviços.",
    "4.4. A CONTRATADA será responsável pela organização da equipe necessária à execução dos serviços contratados, podendo utilizar profissionais próprios, auxiliares, prestadores de serviço ou subcontratados, permanecendo responsável pela coordenação das atividades diretamente vinculadas ao escopo contratado.",
    "4.5. A equipe mobilizada pela CONTRATADA não manterá qualquer vínculo empregatício, trabalhista ou subordinativo com o CONTRATANTE, sendo de responsabilidade da CONTRATADA a gestão dos profissionais vinculados à execução dos serviços sob sua responsabilidade.",
    "4.6. A CONTRATADA deverá orientar sua equipe quanto à organização, segurança, higiene e disciplina no canteiro de obras, observadas as condições do local, a natureza dos serviços contratados e a legislação aplicável.",
    `4.7. Estão inclusos no presente contrato os seguintes serviços:\n\n${formatarLista(
      inclusos,
      "- Serviços conforme escopo técnico aprovado entre as partes."
    )}`,
    "4.8. Fica expressamente excluído do presente contrato tudo aquilo que não estiver descrito como serviço incluso, obrigação da CONTRATADA ou item expressamente contratado entre as partes."
  ];

  return linhas.join("\n\n");
}

function montarClausulaMateriais(dados) {
  const materiais = dados.materiais || {};
  const tipo = texto(materiais.tipo_materiais, "somente_mao_obra");

  let linhas = [];

  if (tipo === "fornecimento_domum") {
    linhas = [
      "5.1. A CONTRATADA será responsável pela aquisição, administração e fornecimento dos materiais, insumos e itens necessários à execução dos serviços contratados, observadas as especificações, quantidades, padrões, limites de valores e condições previstas neste contrato, na proposta comercial, no orçamento, no memorial descritivo e/ou nos anexos vinculados à contratação.",
      "5.2. A escolha, substituição ou alteração de materiais, marcas, modelos, padrões, acabamentos ou especificações inicialmente previstos dependerá de aprovação prévia entre as partes.",
      "5.3. Caso o CONTRATANTE solicite material, marca, acabamento, padrão ou especificação com valor superior ao inicialmente previsto, a diferença de preço deverá ser previamente aprovada e custeada pelo CONTRATANTE, podendo ensejar revisão de prazo, valor ou formalização de aditivo contratual.",
      "5.4. A CONTRATADA não se responsabiliza por atrasos decorrentes de indisponibilidade de materiais no mercado, atraso de fornecedores, alterações solicitadas pelo CONTRATANTE, substituições de especificações ou eventos externos que impactem o fornecimento."
    ];
  } else if (tipo === "administracao_compra_cliente") {
    linhas = [
      "5.1. Os materiais e insumos necessários à execução da obra serão custeados pelo CONTRATANTE, salvo disposição expressa em sentido contrário.",
      "5.2. A CONTRATADA poderá orientar, especificar, cotar, indicar fornecedores, organizar pedidos ou auxiliar na administração da aquisição dos materiais necessários à execução dos serviços contratados, conforme alinhamento entre as partes.",
      "5.3. A responsabilidade financeira pela aquisição dos materiais permanecerá com o CONTRATANTE, incluindo pagamentos a fornecedores, aprovações de orçamento, liberações de compra e eventuais diferenças de valores.",
      "5.4. Atrasos na aprovação, pagamento, entrega, substituição ou disponibilização de materiais poderão impactar diretamente o cronograma da obra, sem que isso configure atraso ou inadimplemento da CONTRATADA.",
      "5.5. Caso o CONTRATANTE opte por fornecedor, marca, especificação ou material diverso daquele indicado ou validado tecnicamente pela CONTRATADA, eventuais impactos de prazo, qualidade, compatibilidade ou custo serão de responsabilidade do CONTRATANTE."
    ];
  } else {
    linhas = [
      "5.1. Os materiais, insumos, ferramentas especiais, equipamentos específicos, peças, componentes e demais itens necessários à execução da obra não estão inclusos no valor contratado, salvo previsão expressa em sentido contrário.",
      "5.2. Caberá ao CONTRATANTE adquirir, pagar, fornecer e disponibilizar no local da obra, em tempo hábil, todos os materiais e insumos necessários à execução dos serviços contratados.",
      "5.3. A ausência, insuficiência, atraso, divergência, inadequação ou não aprovação de materiais fornecidos pelo CONTRATANTE poderá impactar diretamente o cronograma de execução, sem que isso configure atraso ou inadimplemento da CONTRATADA.",
      "5.4. Caso a CONTRATADA identifique que determinado material fornecido pelo CONTRATANTE é incompatível, insuficiente, inadequado ou tecnicamente desaconselhável para a execução dos serviços, deverá comunicar o CONTRATANTE para definição das providências cabíveis."
    ];
  }

  if (materiais.possui_limite_acabamento && tem(materiais.limite_materiais_acabamento)) {
    linhas.push(
      `5.${linhas.length + 1}. Quando houver previsão de materiais de acabamento com limite de valor, fica estabelecido que a contratação considera o limite de ${texto(
        materiais.limite_materiais_acabamento
      )}. A escolha de materiais com valor superior ao limite previsto dependerá de aprovação prévia e pagamento da diferença pelo CONTRATANTE.`
    );
  }

  if (tem(materiais.observacoes_materiais)) {
    linhas.push(`5.${linhas.length + 1}. ${texto(materiais.observacoes_materiais)}`);
  }

  return linhas.join("\n\n");
}

function formatarItensValor(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return "";

  return itens
    .map((item) => {
      const extenso = tem(item.valor_extenso) ? ` (${texto(item.valor_extenso)})` : "";
      return `- ${texto(item.descricao)}: ${texto(item.valor)}${extenso};`;
    })
    .join("\n");
}

function formatarEtapasPagamento(etapas) {
  if (!Array.isArray(etapas) || etapas.length === 0) return "";

  return etapas
    .map((etapa) => {
      const extenso = tem(etapa.valor_extenso) ? ` (${texto(etapa.valor_extenso)})` : "";
      const marco = tem(etapa.vencimento_ou_marco)
        ? `, ${texto(etapa.vencimento_ou_marco)}`
        : "";
      return `- ${texto(etapa.etapa)}: ${texto(etapa.valor)}${extenso}${marco};`;
    })
    .join("\n");
}

function montarClausulaValoresPagamento(dados) {
  const valores = dados.valores || {};
  const pagamento = dados.pagamento || {};

  const linhas = [];

  let subitem = 1;

  function proximoSubitem() {
    return `6.1.${subitem++}.`;
  }

  linhas.push(
    `6.1. Pela execução dos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor de ${texto(
      valores.valor_total,
      "valor não informado"
    )} (${texto(
      valores.valor_total_extenso,
      "valor por extenso não informado"
    )}), conforme as condições de pagamento estabelecidas abaixo.`
  );

  if (valores.possui_composicao_valores) {
    if (Array.isArray(valores.itens_valor) && valores.itens_valor.length > 0) {
      linhas.push(
        `${proximoSubitem()} O valor contratado é composto pelas seguintes etapas ou itens:\n\n${formatarItensValor(
          valores.itens_valor
        )}`
      );
    } else if (tem(valores.valor_mao_obra) || tem(valores.valor_materiais)) {
      linhas.push(
        [
          `${proximoSubitem()} O valor contratado é composto da seguinte forma:`,
          "",
          `- Mão de obra: ${texto(valores.valor_mao_obra)} (${texto(
            valores.valor_mao_obra_extenso
          )});`,
          `- Materiais: ${texto(valores.valor_materiais)} (${texto(
            valores.valor_materiais_extenso
          )});`,
          `- Valor total do contrato: ${texto(valores.valor_total)} (${texto(
            valores.valor_total_extenso
          )}).`
        ].join("\n")
      );
    }
  }

  const tipoPagamento = texto(pagamento.tipo_pagamento, "avista");

  if (tipoPagamento === "entrada_etapas") {
    linhas.push(
      [
        `${proximoSubitem()} O pagamento será realizado da seguinte forma:`,
        "",
        `- Entrada contratual: ${texto(pagamento.valor_entrada)} (${texto(
          pagamento.valor_entrada_extenso
        )}), equivalente a ${texto(
          pagamento.percentual_entrada
        )} do valor total do contrato, devida na assinatura deste instrumento;`,
        `- Saldo remanescente: ${texto(pagamento.valor_saldo)} (${texto(
          pagamento.valor_saldo_extenso
        )}), distribuído conforme as etapas de execução descritas abaixo:`,
        "",
        formatarEtapasPagamento(pagamento.etapas_pagamento)
      ].join("\n")
    );
  } else if (tipoPagamento === "entrada_parcelas") {
    linhas.push(
      [
        `${proximoSubitem()} O pagamento será realizado da seguinte forma:`,
        "",
        `- Entrada contratual: ${texto(pagamento.valor_entrada)} (${texto(
          pagamento.valor_entrada_extenso
        )}), devida na assinatura deste instrumento;`,
        `- Saldo remanescente: ${texto(pagamento.valor_saldo)} (${texto(
          pagamento.valor_saldo_extenso
        )}), dividido em ${texto(
          pagamento.quantidade_parcelas
        )} parcelas de ${texto(pagamento.valor_parcela)} (${texto(
          pagamento.valor_parcela_extenso
        )}).`
      ].join("\n")
    );
  } else if (tipoPagamento === "parcelado_simples") {
    linhas.push(
      [
        `${proximoSubitem()} O pagamento será realizado da seguinte forma:`,
        "",
        `- Valor total: ${texto(valores.valor_total)} (${texto(
          valores.valor_total_extenso
        )});`,
        `- Condição de pagamento: ${texto(
          pagamento.quantidade_parcelas
        )} parcelas de ${texto(pagamento.valor_parcela)} (${texto(
          pagamento.valor_parcela_extenso
        )}), com vencimentos conforme acordado entre as partes.`
      ].join("\n")
    );
  } else if (tipoPagamento === "medicao") {
    linhas.push(
      `${proximoSubitem()} O pagamento será realizado por medição dos serviços executados, conforme avanço físico da obra, escopo contratado e validação entre as partes.`
    );

    linhas.push(
      `${proximoSubitem()} Cada medição deverá considerar os serviços efetivamente executados no período, podendo ser acompanhada de relatório, registro fotográfico, planilha, diário de obra ou outro meio de comprovação acordado entre as partes.`
    );

    linhas.push(
      `${proximoSubitem()} Os valores apurados em cada medição deverão ser pagos pelo CONTRATANTE conforme prazo e forma previamente estabelecidos entre as partes.`
    );
  } else {
    linhas.push(
      [
        `${proximoSubitem()} O pagamento será realizado da seguinte forma:`,
        "",
        `- Pagamento à vista: ${texto(valores.valor_total)} (${texto(
          valores.valor_total_extenso
        )}), devido na assinatura deste instrumento ou conforme data acordada entre as partes.`
      ].join("\n")
    );
  }

  if (tem(pagamento.observacoes_pagamento)) {
    linhas.push(`${proximoSubitem()} ${texto(pagamento.observacoes_pagamento)}`);
  }

  linhas.push(
    [
      "6.2. Os pagamentos deverão ser realizados por meio dos seguintes dados bancários:",
      "",
      "Banco: Santander",
      "Tipo: Conta Corrente",
      "Agência: 1147",
      "Conta: 13.00.4657-1",
      "Chave PIX: 33.388.796/0001-50"
    ].join("\n")
  );

  linhas.push(
    "6.3. É de responsabilidade da CONTRATADA o recolhimento dos impostos, taxas, contribuições e demais encargos fiscais incidentes sobre os valores recebidos em razão dos serviços contratados, observada a legislação aplicável."
  );

  linhas.push(
    "6.4. O não pagamento de qualquer parcela, etapa, medição ou valor devido nas condições pactuadas poderá impactar o andamento da obra, inclusive com possibilidade de suspensão dos serviços até a regularização dos pagamentos pendentes, sem que isso configure atraso ou inadimplemento da CONTRATADA."
  );

  return linhas.join("\n\n");
}

function montarTabelaCronograma(etapas) {
  if (!Array.isArray(etapas) || etapas.length === 0) return "";

  const linhas = [
    "Atividade | Previsão de Início | Previsão de Término | Valor da Etapa"
  ];

  etapas.forEach((etapa) => {
    linhas.push(
      `${texto(etapa.atividade)} | ${texto(etapa.data_inicio)} | ${texto(
        etapa.data_termino
      )} | ${texto(etapa.valor_etapa)}`
    );
  });

  return linhas.join("\n");
}

function montarClausulaPrazoCronograma(dados) {
  const prazo = dados.prazo_cronograma || {};
  const linhas = [
    "7.1. Os prazos relativos à execução dos serviços contratados serão definidos conforme o escopo da empreitada, as condições da obra, a disponibilidade de materiais, a liberação do local, a aprovação dos documentos necessários, o cumprimento das condições de pagamento e o cronograma acordado entre as partes."
  ];

  if (prazo.possui_cronograma_detalhado) {
    linhas.push(
      `7.1.1. O cronograma de execução dos serviços será o seguinte:\n\n${montarTabelaCronograma(
        prazo.cronograma_etapas
      )}`
    );
  } else {
    linhas.push(
      [
        `7.1.1. O prazo estimado para execução dos serviços será de ${texto(
          prazo.prazo_total,
          "prazo não informado"
        )}, contado a partir de ${texto(
          prazo.marco_inicial_prazo,
          "marco inicial não informado"
        )}, desde que estejam disponíveis todos os materiais, informações, acessos, autorizações, pagamentos iniciais e demais condições necessárias ao início e continuidade da execução.`,
        "7.1.2. Caso seja necessário, o cronograma detalhado poderá ser elaborado ou ajustado posteriormente entre as partes, considerando o andamento da obra, a disponibilidade de materiais, as definições técnicas e demais condições práticas de execução."
      ].join("\n\n")
    );
  }

  linhas.push(
    [
      "7.2. O prazo de execução poderá ser alterado nas seguintes hipóteses:",
      "",
      "- alteração de projeto, escopo, especificações, materiais ou serviços após a assinatura do contrato;",
      "- solicitação de pausa, suspensão, interrupção ou reprogramação por parte do CONTRATANTE;",
      "- atraso no fornecimento, aprovação, pagamento, entrega ou substituição de materiais;",
      "- atraso na liberação de acesso ao imóvel ou impedimento de execução;",
      "- necessidade de correções, compatibilizações ou definições técnicas não previstas inicialmente;",
      "- ocorrência de chuvas, eventos climáticos, força maior, caso fortuito ou fatores externos que impactem a execução;",
      "- paralisação por determinação de órgãos públicos, concessionárias, condomínio, vizinhos ou terceiros;",
      "- atraso de fornecedores, transportadoras, fabricantes ou demais terceiros envolvidos;",
      "- outras situações que interfiram diretamente no planejamento e andamento da obra."
    ].join("\n")
  );

  linhas.push(
    "7.3. Eventual alteração de prazo decorrente das hipóteses acima não configurará atraso ou inadimplemento da CONTRATADA, desde que devidamente comunicada ao CONTRATANTE e relacionada a fato que impacte a execução dos serviços contratados."
  );

  return linhas.join("\n\n");
}

function montarClausulaObrigacoesContratante(dados) {
  const materiais = dados.materiais || {};
  const documentos = dados.documentos_tecnicos || {};
  const extras = lista(dados.obrigacoes_contratante_adicionais);

  const topicos = [
    "a) realizar os pagamentos nas datas, valores e condições estabelecidas neste contrato, na proposta comercial, no cronograma financeiro ou em seus anexos;",
    "b) fornecer à CONTRATADA todas as informações, documentos, projetos, autorizações, aprovações, liberações e definições necessárias à execução dos serviços contratados;",
    "c) garantir o acesso da CONTRATADA, de sua equipe, prestadores de serviço e fornecedores ao local da obra, em dias e horários compatíveis com a execução dos serviços;",
    "d) manter disponíveis no local da obra as condições mínimas necessárias à execução, incluindo, quando aplicável, fornecimento de água, energia elétrica, esgoto, acesso físico, local para recebimento de materiais e demais estruturas indispensáveis ao andamento da empreitada;",
    "e) aprovar materiais, especificações, alterações, compras, definições técnicas, etapas, medições ou decisões necessárias ao andamento da obra em tempo hábil;",
    "f) comunicar formalmente à CONTRATADA qualquer solicitação de alteração de escopo, pausa, interrupção, substituição de materiais, modificação de projeto ou reprogramação da execução;",
    "g) responsabilizar-se por custos, taxas, autorizações, serviços, contratações, fornecimentos ou obrigações que não estejam expressamente incluídos no escopo contratado;",
    "h) não interferir diretamente na execução dos serviços, na gestão da equipe, na contratação de auxiliares ou na organização técnica da obra, salvo para solicitar esclarecimentos, registrar inconformidades ou aprovar decisões que dependam de sua manifestação;",
    "i) comunicar por escrito qualquer inconformidade, divergência, vício aparente ou insatisfação relacionada aos serviços executados, permitindo que a CONTRATADA realize a análise técnica e adote as providências cabíveis;",
    "j) não contratar diretamente integrantes da equipe, prestadores de serviço, fornecedores ou profissionais mobilizados, indicados ou apresentados pela CONTRATADA no contexto da execução da obra, salvo mediante autorização expressa da CONTRATADA;",
    "k) responsabilizar-se pela veracidade das informações, documentos, projetos, medidas, condições do imóvel e demais dados fornecidos à CONTRATADA para elaboração, planejamento e execução da empreitada."
  ].join("\n");

  const linhas = [
    "8.1. São obrigações do CONTRATANTE:",
    topicos
  ];

  let proximo = 2;

  if (
    materiais.tipo_materiais === "somente_mao_obra" ||
    materiais.tipo_materiais === "administracao_compra_cliente"
  ) {
    linhas.push(
      `8.${proximo}. Quando os materiais forem de responsabilidade do CONTRATANTE, caberá a este adquiri-los, pagá-los, aprová-los e disponibilizá-los no local da obra em tempo hábil, observando as especificações técnicas, quantidades, prazos e orientações necessárias à adequada execução dos serviços.`
    );
    proximo++;

    linhas.push(
      `8.${proximo}. A ausência, atraso, insuficiência, inadequação ou substituição de materiais sob responsabilidade do CONTRATANTE poderá impactar diretamente o cronograma, os custos e a continuidade da execução, sem que isso configure atraso ou inadimplemento da CONTRATADA.`
    );
    proximo++;
  }

  if (dados.possui_condominio_regras_acesso) {
    linhas.push(
      `8.${proximo}. Quando a obra estiver sujeita a regras de condomínio, portaria, administração predial, vizinhança, órgãos públicos ou terceiros, caberá ao CONTRATANTE providenciar as autorizações, liberações, cadastros, comunicados e condições necessárias para acesso da CONTRATADA ao local da obra e execução dos serviços nos horários permitidos.`
    );
    proximo++;
  }

  if (documentos.origem === "terceiro") {
    linhas.push(
      `8.${proximo}. Quando a execução estiver baseada em projetos ou documentos técnicos elaborados por terceiros, caberá ao CONTRATANTE providenciar esclarecimentos, revisões, compatibilizações, aprovações ou complementações junto aos respectivos autores, sempre que tais providências forem necessárias ao andamento da obra.`
    );
    proximo++;
  }

  if (extras.length > 0) {
    linhas.push(`8.${proximo}. Obrigações adicionais do CONTRATANTE:\n${formatarLista(extras)}`);
  }

  return linhas.join("\n\n");
}

function montarClausulaObrigacoesContratada(dados) {
  const documentos = dados.documentos_tecnicos || {};
  const extras = lista(dados.obrigacoes_contratada_adicionais);

  const topicos = [
    "a) executar os serviços contratados conforme o escopo previsto neste instrumento, na proposta comercial, no orçamento, no memorial descritivo, nos documentos técnicos de referência e/ou nos anexos vinculados ao contrato, quando houver;",
    "b) organizar, coordenar e administrar a equipe necessária à execução dos serviços contratados, podendo utilizar profissionais próprios, auxiliares, prestadores de serviço ou subcontratados, conforme a natureza da empreitada;",
    "c) orientar sua equipe quanto à organização, segurança, higiene, disciplina e boas práticas aplicáveis ao canteiro de obras;",
    "d) comunicar ao CONTRATANTE intercorrências relevantes que possam impactar prazo, custo, escopo, qualidade, sequência executiva ou continuidade dos serviços;",
    "e) informar previamente a necessidade de alterações de escopo, serviços complementares, substituição de materiais, revisão de prazo, revisão de valor ou formalização de aditivo contratual, quando tais situações forem identificadas durante a execução;",
    "f) responder por danos causados diretamente por sua atuação dolosa ou culposa, inclusive quando praticados por profissionais, prestadores ou subcontratados sob sua responsabilidade direta;",
    "g) zelar pela correta execução dos serviços que estiverem sob sua responsabilidade, observadas as condições do local, os documentos técnicos disponíveis, o escopo contratado e as limitações expressamente previstas neste contrato;",
    "h) manter comunicação com o CONTRATANTE pelos meios admitidos entre as partes, especialmente para registro de decisões, aprovações, ocorrências, pendências e solicitações relacionadas à obra;",
    "i) recolher os tributos, encargos e obrigações fiscais incidentes sobre os valores recebidos em razão dos serviços contratados, observada a legislação aplicável;",
    "j) manter autonomia técnica, administrativa e operacional na execução dos serviços contratados, sem subordinação trabalhista, empregatícia ou funcional ao CONTRATANTE."
  ].join("\n");

  const linhas = [
    "9.1. São obrigações da CONTRATADA:",
    topicos
  ];

  let proximo = 2;

  if (dados.possui_art_execucao) {
    linhas.push(
      `9.${proximo}. Quando aplicável, a CONTRATADA providenciará a emissão da respectiva Anotação de Responsabilidade Técnica — ART, ou documento técnico equivalente, referente aos serviços sob sua responsabilidade, observadas as atribuições profissionais, o escopo contratado e as exigências legais pertinentes.`
    );
    proximo++;
  }

  if (dados.permite_subcontratacao !== false) {
    linhas.push(
      `9.${proximo}. A CONTRATADA poderá contratar terceiros, equipes especializadas, fornecedores ou prestadores de serviço para execução de atividades vinculadas ao escopo contratado, permanecendo responsável pela coordenação dos serviços diretamente assumidos neste contrato.`
    );
    proximo++;
  }

  if (documentos.origem === "terceiro") {
    linhas.push(
      `9.${proximo}. Quando a execução estiver baseada em projetos ou documentos técnicos elaborados por terceiros, a responsabilidade da CONTRATADA ficará limitada à execução dos serviços contratados, não abrangendo autoria, compatibilização, aprovação legal ou responsabilidade técnica dos projetos fornecidos pelo CONTRATANTE.`
    );
    proximo++;
  }

  if (extras.length > 0) {
    linhas.push(`9.${proximo}. Obrigações adicionais da CONTRATADA:\n${formatarLista(extras)}`);
  }

  return linhas.join("\n\n");
}
function montarClausulaRescisao(dados) {
  const r = dados.rescisao || {};

  const prazoInterrupcao = texto(r.prazo_interrupcao_contratada, "10");
  const prazoAtrasoConclusao = texto(r.prazo_atraso_conclusao, "30");
  const prazoAtrasoPagamento = texto(r.prazo_atraso_pagamento, "15");
  const prazoSanacao = texto(r.prazo_sanacao_inadimplemento, "10");
  const antecedenciaPausa = texto(r.antecedencia_pausa, "10");
  const prazoPausa = texto(r.prazo_pausa_caracterizada, "20");
  const prazoAbandono = texto(r.prazo_abandono, "12 meses");

  return [
    "10.1. O presente contrato poderá ser rescindido pelo CONTRATANTE nas seguintes hipóteses:",
    "",
    "a) inadimplemento de qualquer cláusula ou condição deste contrato pela CONTRATADA;",
    "",
    `b) interrupção injustificada dos serviços por período superior a ${prazoInterrupcao} dias consecutivos;`,
    "",
    `c) atraso injustificado no prazo total de conclusão dos serviços por período superior a ${prazoAtrasoConclusao} dias consecutivos, desde que não decorrente de culpa do CONTRATANTE, alteração de escopo, ausência de materiais, atraso de pagamentos, condições climáticas, caso fortuito, força maior ou fatores externos que impactem a execução;`,
    "",
    "d) descumprimento grave das obrigações assumidas pela CONTRATADA, desde que previamente comunicado e não sanado no prazo aplicável, quando possível.",
    "",
    "10.2. O presente contrato poderá ser rescindido pela CONTRATADA nas seguintes hipóteses:",
    "",
    "a) inadimplemento de qualquer cláusula ou condição deste contrato pelo CONTRATANTE;",
    "",
    `b) atraso no pagamento de qualquer parcela, etapa, medição ou valor devido por período superior a ${prazoAtrasoPagamento} dias consecutivos;`,
    "",
    "c) impossibilidade de continuidade dos serviços por ausência de materiais, informações, aprovações, acessos, autorizações ou condições mínimas de execução;",
    "",
    "d) alteração substancial do escopo contratado sem formalização de aditivo contratual;",
    "",
    "e) interferência indevida do CONTRATANTE na equipe, fornecedores, prestadores de serviço, sequência executiva ou organização técnica da obra;",
    "",
    "f) conduta do CONTRATANTE que inviabilize a continuidade da relação contratual ou a adequada execução dos serviços.",
    "",
    `10.3. Em caso de inadimplemento total ou parcial de qualquer obrigação prevista neste contrato, a parte inadimplente poderá ser notificada para sanar a irregularidade no prazo de ${prazoSanacao} dias corridos, salvo quando a gravidade ou a natureza do descumprimento justificar rescisão imediata.`,
    "",
    "10.4. No caso de rescisão, a CONTRATADA poderá apresentar levantamento dos serviços executados, serviços em andamento, materiais adquiridos, materiais comprometidos, custos incorridos, despesas de mobilização, desmobilização ou reprogramação, bem como eventuais valores pendentes de pagamento.",
    "",
    `10.5. Em caso de solicitação de pausa, suspensão ou interrupção da obra por iniciativa do CONTRATANTE, este deverá comunicar a CONTRATADA com antecedência mínima de ${antecedenciaPausa} dias úteis.`,
    "",
    "10.6. Antes da paralisação solicitada pelo CONTRATANTE, deverão ser quitados os serviços já executados, os serviços em andamento, os materiais já adquiridos ou comprometidos e eventuais custos decorrentes de desmobilização, remobilização, armazenamento, reagendamento de equipe ou reprogramação da obra.",
    "",
    `10.7. Quando a interrupção solicitada pelo CONTRATANTE exceder ${prazoPausa} dias corridos, poderá ser caracterizada pausa contratual, sendo necessária a reavaliação do cronograma, da disponibilidade de equipe, dos custos e das condições de retomada.`,
    "",
    `10.8. Caso o CONTRATANTE deixe de dar andamento à contratação, deixe de responder solicitações essenciais, suspenda indefinidamente a obra ou permaneça inerte por período superior a ${prazoAbandono}, o contrato poderá ser considerado encerrado, sem prejuízo da cobrança dos valores devidos até então.`,
    "",
    "10.9. Para retomada posterior dos serviços após abandono, pausa prolongada ou encerramento operacional, poderá ser exigida nova contratação, novo orçamento ou aditivo contratual, conforme avaliação da CONTRATADA.",
    "",
    "10.10. Na hipótese de resilição bilateral, as partes poderão formalizar Termo de Distrato, estabelecendo as condições de encerramento, quitação, pendências, pagamentos devidos, entrega de documentos e demais obrigações remanescentes."
  ].join("\n");
}
function montarClausulaMultas(dados) {
  const m = dados.multas || {};

  const multaRescisoria = texto(m.percentual_multa_rescisoria, "10%");
  const multaMoratoria = texto(m.percentual_multa_moratoria, "2%");
  const jurosMora = texto(m.percentual_juros_mora, "1%");
  const indiceCorrecao = texto(m.indice_correcao, "IPCA");

  return [
    `11.1. A rescisão imotivada deste contrato por qualquer das partes, sem amparo nas hipóteses previstas neste instrumento, sujeitará a parte que der causa à rescisão ao pagamento de multa equivalente a ${multaRescisoria} sobre o valor total do contrato, sem prejuízo da apuração de valores já devidos, serviços executados, materiais adquiridos, custos incorridos e eventuais perdas e danos.`,
    `11.2. Em caso de atraso no pagamento de qualquer parcela, etapa, medição ou valor devido pelo CONTRATANTE, poderão incidir multa moratória de ${multaMoratoria}, juros de ${jurosMora} ao mês, calculados pro rata die, e correção monetária pelo índice ${indiceCorrecao}, salvo se outra condição tiver sido expressamente pactuada entre as partes.`,
    "11.3. O atraso no pagamento poderá autorizar a suspensão da execução dos serviços até a regularização integral dos valores pendentes, sem que isso configure atraso, abandono, inadimplemento ou descumprimento contratual por parte da CONTRATADA.",
    "11.4. A aplicação de multa, juros, correção ou encargos não afasta o direito da parte prejudicada de buscar indenização por perdas e danos, quando cabível e devidamente comprovado.",
    "11.5. Na hipótese de distrato ou resilição bilateral formalizada entre as partes, as multas poderão ser afastadas, reduzidas ou ajustadas conforme as condições expressamente previstas no respectivo Termo de Distrato."
  ].join("\n\n");
}

function montarClausulaDisposicoesGerais(dados) {
  const extras = lista(dados.disposicoes_gerais_adicionais);

  const linhas = [
    "12.1. A CONTRATADA compromete-se a manter sigilo sobre informações técnicas, comerciais, financeiras, pessoais ou estratégicas do CONTRATANTE às quais venha a ter acesso em razão da execução deste contrato, salvo quando a divulgação for necessária ao cumprimento do contrato, exigida por lei, solicitada por autoridade competente ou autorizada pelo CONTRATANTE.",
    "12.2. Caso o CONTRATANTE identifique irregularidade, divergência, vício aparente, inconformidade ou insatisfação relacionada aos serviços executados, deverá comunicar a CONTRATADA por escrito, permitindo a análise técnica e a adoção das providências cabíveis.",
    "12.3. A aceitação parcial dos serviços, o pagamento de parcelas, o acompanhamento da execução ou a continuidade da obra não implicam renúncia automática a direitos decorrentes de eventual descumprimento contratual, desde que a inconformidade seja formalmente comunicada e tecnicamente comprovada.",
    "12.4. As comunicações entre as partes poderão ser realizadas por escrito, incluindo e-mail, aplicativos de mensagem, atas de reunião, diário de obra, notificações formais ou outros meios admitidos pelas partes.",
    "12.5. Qualquer alteração de escopo, prazo, valor, material, especificação, etapa, condição de execução ou responsabilidade das partes deverá ser previamente aprovada, podendo exigir orçamento complementar, termo aditivo ou documento equivalente.",
    "12.6. A tolerância de qualquer das partes quanto ao descumprimento de obrigação contratual não será interpretada como renúncia de direito, alteração contratual ou novação, permanecendo válidas todas as demais cláusulas e condições deste instrumento.",
    "12.7. Este contrato obriga as partes, seus sucessores e cessionários, a qualquer título, respeitadas as condições aqui estabelecidas.",
    "12.8. Fica expressamente excluído do presente contrato tudo aquilo que não estiver descrito como serviço incluso, obrigação da CONTRATADA ou item expressamente contratado entre as partes."
  ];

  if (extras.length > 0) {
    linhas.push(`12.9. Disposições adicionais:\n\n${formatarLista(extras)}`);
  }

  return linhas.join("\n\n");
}

function montarItensNaoInclusos(dados) {
  const itens = lista(dados.servicos_nao_inclusos);

  if (itens.length === 0) {
    return [
      "13.1. Não estão inclusos no valor contratado todos os serviços, fornecimentos, materiais, aprovações, taxas, despesas, responsabilidades ou atividades que não estejam expressamente descritos como obrigação da CONTRATADA ou como item incluído no escopo contratado.",
      "13.2. Quando aplicável, serão de responsabilidade do CONTRATANTE despesas relativas a consumo de água, energia elétrica, esgoto, taxas condominiais, liberações de acesso, autorizações, alvarás, licenças, aprovações públicas, taxas de concessionárias, contratação de terceiros e demais custos externos não previstos expressamente como obrigação da CONTRATADA."
    ].join("\n\n");
  }

  return [
    "13.1. Não estão inclusos no valor contratado, sendo de responsabilidade do CONTRATANTE, salvo previsão expressa em contrário:",
    "",
    formatarLista(itens),
    "",
    "13.2. Quando aplicável, também serão de responsabilidade do CONTRATANTE despesas relativas a consumo de água, energia elétrica, esgoto, taxas condominiais, liberações de acesso, autorizações, alvarás, licenças, aprovações públicas, taxas de concessionárias, contratação de terceiros e demais custos externos não previstos expressamente como obrigação da CONTRATADA.",
    "",
    "13.3. A contratação de serviços, fornecimentos, aprovações, projetos, documentos ou atividades não incluídas no escopo deste contrato dependerá de proposta complementar, orçamento específico ou aditivo contratual."
  ].join("\n");
}

function montarClausulaUsoImagem(dados) {
  if (dados.autoriza_uso_imagem === true) {
    return [
      "14.1. O CONTRATANTE autoriza a CONTRATADA a fotografar, filmar e divulgar imagens da obra, do processo executivo e dos resultados dos serviços prestados, para fins institucionais, comerciais, técnicos, publicitários, portfólio, redes sociais e materiais de divulgação da DOMUM ENGENHARIA, respeitados os limites legais e a preservação de dados pessoais sensíveis.",
      "14.2. A autorização prevista nesta cláusula não permite a divulgação de dados pessoais sensíveis, documentos particulares, informações financeiras, dados cadastrais, informações de segurança, imagens íntimas ou elementos que exponham indevidamente o CONTRATANTE, sua família, usuários do imóvel ou terceiros."
    ].join("\n\n");
  }

  return [
    "14.1. A CONTRATADA não poderá divulgar imagens da obra, do imóvel, do processo executivo ou dos resultados dos serviços prestados para fins comerciais, publicitários, institucionais, portfólio ou redes sociais sem autorização prévia e expressa do CONTRATANTE.",
    "14.2. A vedação prevista nesta cláusula não impede a realização de registros fotográficos, vídeos, relatórios ou documentos internos necessários ao acompanhamento técnico, comprovação de execução, controle de qualidade, medição, comunicação entre as partes ou resguardo de direitos da CONTRATADA."
  ].join("\n\n");
}

function montarClausulaForo(dados) {
  const dataContrato = obterDataContrato(dados.data_contrato);

  return [
    "15.1. As partes elegem o foro da Comarca de Maringá/PR para dirimir quaisquer dúvidas, controvérsias ou questões decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.",
    "15.2. Fica facultado às partes, em comum acordo, submeter eventual controvérsia a mediação, conciliação ou juízo arbitral, quando cabível.",
    "15.3. E, por estarem justas e contratadas, assinam as partes o presente instrumento, para que produza seus jurídicos e regulares efeitos, obrigando-se por si, seus sucessores e cessionários a qualquer título.",
    `Maringá/PR, ${dataContrato}.`
  ].join("\n\n");
}

function montarBlocoAssinaturas(dados, representante) {
  const contratante = dados.contratante || {};

  const linhas = [
    "________________________________________",
    "RODRIGUES & MADUREIRA LTDA",
    "CNPJ: 33.388.796/0001-50",
    representante.nome
  ];

  if (tem(representante.cpf)) {
    linhas.push(`CPF: ${representante.cpf}`);
  }

  linhas.push(representante.registroAssinatura);
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
    dados.possui_testemunhas &&
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
  const representante = obterRepresentanteDomum(
    dados.representante_domum,
    dados.representante_domum_cpf
  );

  const contratante = dados.contratante || {};

  const nomeExibicao =
    dados.tipo_contratante === "pessoa_juridica"
      ? texto(contratante.razao_social)
      : texto(contratante.nome);

  return {
    tipo_contrato: texto(dados.tipo_contrato, "EMPREITADA PARCIAL"),
    contratante_nome_exibicao: nomeExibicao.toUpperCase(),

    bloco_contratante: montarBlocoContratante(dados.tipo_contratante, contratante),
    bloco_contratada: montarBlocoContratada(representante),

    representante_domum_nome: representante.nome,
    representante_domum_registro: representante.registro,

    clausula_objeto_conteudo: montarClausulaObjeto(dados),
    clausula_documentos_tecnicos_conteudo: montarClausulaDocumentosTecnicos(dados, representante),
    clausula_servicos_contratados_conteudo: montarClausulaServicos(dados),
    clausula_materiais_conteudo: montarClausulaMateriais(dados),
    clausula_valores_pagamento_conteudo: montarClausulaValoresPagamento(dados),
    clausula_prazo_cronograma_conteudo: montarClausulaPrazoCronograma(dados),
    clausula_obrigacoes_contratante_conteudo: montarClausulaObrigacoesContratante(dados),
    clausula_obrigacoes_contratada_conteudo: montarClausulaObrigacoesContratada(dados),
    clausula_rescisao_conteudo: montarClausulaRescisao(dados),
    clausula_multas_conteudo: montarClausulaMultas(dados),
    clausula_disposicoes_gerais_conteudo: montarClausulaDisposicoesGerais(dados),
    itens_nao_inclusos_formatados: montarItensNaoInclusos(dados),
    clausula_uso_imagem: montarClausulaUsoImagem(dados),
    clausula_foro_conteudo: montarClausulaForo(dados),
    bloco_assinaturas: montarBlocoAssinaturas(dados, representante)
  };
}

function validarDadosBasicos(dados) {
  const erros = [];

  if (!["EMPREITADA PARCIAL", "EMPREITADA GLOBAL"].includes(texto(dados.tipo_contrato))) {
    erros.push("tipo_contrato deve ser EMPREITADA PARCIAL ou EMPREITADA GLOBAL.");
  }

  if (!["pessoa_fisica", "pessoa_juridica"].includes(texto(dados.tipo_contratante))) {
    erros.push("tipo_contratante deve ser pessoa_fisica ou pessoa_juridica.");
  }

  if (!["gustavo", "jonatan"].includes(texto(dados.representante_domum))) {
    erros.push("representante_domum deve ser gustavo ou jonatan.");
  }

  if (!dados.contratante) {
    erros.push("Dados do contratante são obrigatórios.");
  }

  if (!dados.obra) {
    erros.push("Dados da obra são obrigatórios.");
  }

  if (!dados.valores) {
    erros.push("Dados de valores são obrigatórios.");
  }

  if (!dados.pagamento) {
    erros.push("Dados de pagamento são obrigatórios.");
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
    if (nomeArquivo.startsWith("word/") && nomeArquivo.endsWith(".xml")) {
      xml += zip.file(nomeArquivo)?.asText() || "";
    }
  });

  if (xml.includes("{{") || xml.includes("}}")) {
    throw new Error("O documento final ainda possui placeholders não preenchidos.");
  }

  if (xml.includes("undefined")) {
    throw new Error("O documento final possui algum campo com valor undefined.");
  }
}

async function converterDocxParaPdf(docxPath, outputDir) {
  const comandos = ["libreoffice", "soffice"];
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

      const nomePdf = `${path.basename(docxPath, ".docx")}.pdf`;
      const pdfPath = path.join(outputDir, nomePdf);

      if (fs.existsSync(pdfPath)) {
        return pdfPath;
      }
    } catch (error) {
      erros.push(`${comando}: ${error.message}`);
    }
  }

  throw new Error(`Falha ao converter DOCX para PDF. ${erros.join(" | ")}`);
}

function nomeArquivoSeguro(dados) {
  const contratante = dados.contratante || {};
  const nome =
    dados.tipo_contratante === "pessoa_juridica"
      ? texto(contratante.razao_social, "contratante")
      : texto(contratante.nome, "contratante");

  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return `contrato_empreitada_${limpo || "contratante"}_${Date.now()}`;
}

app.post("/gerar-contrato-empreitada", async (req, res) => {
  try {
    const apiKeyEsperada = String(process.env.API_KEY || "").trim();

if (!apiKeyEsperada) {
  return res.status(500).json({
    sucesso: false,
    mensagem: "API_KEY não configurada no servidor."
  });
}

const chaveHeader = String(req.headers["x-api-key"] || "").trim();

const authorization = String(req.headers["authorization"] || "").trim();
const chaveBearer = authorization.toLowerCase().startsWith("bearer ")
  ? authorization.slice(7).trim()
  : "";

const apiKeyRecebida = chaveHeader || chaveBearer;

if (apiKeyRecebida !== apiKeyEsperada) {
  return res.status(401).json({
    sucesso: false,
    mensagem: "Acesso não autorizado."
  });
}

    const dados = req.body || {};

    validarDadosBasicos(dados);

    const dadosContrato = montarDadosContrato(dados);
    const bufferDocx = renderizarDocx(dadosContrato);

    verificarDocxFinal(bufferDocx);

    const nomeBase = nomeArquivoSeguro(dados);
    const tempDocxPath = path.join(tempDir, `${nomeBase}.docx`);

    fs.writeFileSync(tempDocxPath, bufferDocx);

    const pdfPath = await converterDocxParaPdf(tempDocxPath, outputDir);

    try {
      fs.unlinkSync(tempDocxPath);
    } catch {
      // não interrompe a resposta se não conseguir remover temporário
    }

    const baseUrl =
      process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

    return res.json({
      sucesso: true,
      mensagem: "Contrato de empreitada gerado com sucesso.",
      arquivo_pdf: `${baseUrl}/output/${path.basename(pdfPath)}`,
      nome_arquivo: path.basename(pdfPath)
    });
  } catch (error) {
    console.error(error);

    return res.status(error.statusCode || 500).json({
      sucesso: false,
      mensagem: "Erro ao gerar contrato de empreitada.",
      erro: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API DOMUM rodando na porta ${PORT}`);
});
