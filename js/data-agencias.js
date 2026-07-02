// Dados de contato/atendimento das agências de trade, transcritos de
// "AGÊNCIAS E PROMOTORAS 2026.xlsx" (aba Agências) — usando apenas as colunas:
// ESTADOS, AGÊNCIAS, NOME, CONTATO, FORMATO, FECHAMENTO VIA, REDES QUE ATENDE,
// Quant.lojas atendidas.
//
// A coluna "Quant.lojas atendidas" na planilha de origem vem uma linha por REDE
// (não um total único por agência) — por isso aqui cada rede tem sua própria
// contagem, com "qtdLojasTotal" sendo a soma. Quando a planilha de origem não
// trazia um número legível/consistente para uma rede, o campo fica como `null`
// e o motivo vai em `obs` — para não inventar dado que a fonte não tem.
const AGENCIAS_DATA = [
  {
    estado: "Santa Catarina",
    agencia: "TOP SUL",
    nome: "Edinho",
    contato: "(48) 98478-2277",
    formato: "Grupo whatsapp",
    fechamentoVia: "DRIVE",
    redes: [
      { nome: "ANGELONI", qtdLojas: 25 },
      { nome: "ARCHER", qtdLojas: 8 },
      { nome: "CARREFOUR", qtdLojas: 2 },
      { nome: "DE ANGELINA", qtdLojas: 4 },
      { nome: "DU BOM", qtdLojas: 3 },
      { nome: "KOCH", qtdLojas: 29 },
      { nome: "MESCHKE", qtdLojas: 4 },
      { nome: "SUPER A", qtdLojas: 6 },
      { nome: "KOMPRÃO", qtdLojas: 68 },
      { nome: "MANENTTI", qtdLojas: 10 },
      { nome: "ALTHOFF", qtdLojas: 10 }
    ],
    qtdLojasTotal: 169
  },
  {
    estado: "Santa Catarina",
    agencia: "PERSORE",
    nome: "Jara",
    contato: "(48) 99191-9907",
    formato: "Grupo whatsapp",
    fechamentoVia: "",
    redes: [
      { nome: "IMPERATRIZ", qtdLojas: 19 },
      { nome: "BRASÃO", qtdLojas: 7 },
      { nome: "CELEIRO", qtdLojas: 6 }
    ],
    qtdLojasTotal: 32
  },
  {
    estado: "Paraná",
    agencia: "FK",
    nome: "Camila",
    contato: "(41) 98518-3169",
    formato: "Grupo whatsapp",
    fechamentoVia: "DRIVE",
    redes: [
      { nome: "MUFFATO", qtdLojas: null },
      { nome: "JACOMAR", qtdLojas: null },
      { nome: "SUPER VITOR", qtdLojas: null },
      { nome: "ANGELONI", qtdLojas: null },
      { nome: "ADEGA BRASIL", qtdLojas: null },
      { nome: "CARREFOUR", qtdLojas: null }
    ],
    qtdLojasTotal: null,
    obs: "A quantidade de lojas por rede não estava legível/completa na planilha de origem (célula sinalizada em vermelho pela própria agência)."
  },
  {
    estado: "Rio Grande do Sul",
    agencia: "TREVISAN",
    nome: "Luciano",
    contato: "(51) 99365-4726",
    formato: "Grupo whatsapp",
    fechamentoVia: "",
    redes: [
      { nome: "RISSUL", qtdLojas: 33 }
    ],
    qtdLojasTotal: 33
  },
  {
    estado: "Rio Grande do Sul",
    agencia: "HOVAN",
    nome: "Cris/Gilberto",
    contato: "(51) 99733-2742",
    formato: "Grupo whatsapp",
    fechamentoVia: "",
    redes: [
      { nome: "CARREFOUR", qtdLojas: null },
      { nome: "ASUN", qtdLojas: null }
    ],
    qtdLojasTotal: null,
    obs: "Quantidade de lojas não veio como número separado na planilha de origem (a célula continha a data de fechamento, dia 20 de cada mês). Nome da rede grafado \"ASSUN\" na planilha de agências; usamos \"ASUN\", como aparece no roteiro de cobertura."
  },
  {
    estado: "São Paulo",
    agencia: "SUPER TRADE",
    nome: "Fabiano/Thalia",
    contato: "(11) 98913-7876 / (11) 99246-1980",
    formato: "Grupo e sistema",
    fechamentoVia: "APP AGÊNCIA",
    redes: [
      { nome: "CARREFOUR", qtdLojas: 24 }
    ],
    qtdLojasTotal: 24
  },
  {
    estado: "São Paulo",
    agencia: "ANGELA & JO",
    nome: "Angela",
    contato: "(11) 99859-8386",
    formato: "Sistema",
    fechamentoVia: "",
    redes: [
      { nome: "COOP", qtdLojas: 25 }
    ],
    qtdLojasTotal: 25
  },
  {
    estado: "Minas Gerais",
    agencia: "OPUS TRADE",
    nome: "Helder",
    contato: "(21) 99786-2610",
    formato: "Grupo whatsapp",
    fechamentoVia: "",
    redes: [
      { nome: "CARREFOUR", qtdLojas: 6 }
    ],
    qtdLojasTotal: 6
  },
  {
    estado: "Rio de Janeiro",
    agencia: "OPUS TRADE",
    nome: "Silvio / Helder",
    contato: "(21) 99816-7338 / (21) 99786-2610",
    formato: "Grupo whatsapp",
    fechamentoVia: "",
    redes: [
      { nome: "CARREFOUR", qtdLojas: 9 }
    ],
    qtdLojasTotal: 9
  }
];
