// L-45 — the content kit for the product's own social profiles, December 2026.
//
// ONE source for everything the owner posts this month: the calendar, every carousel slide and
// every caption. `assets-src/social/build.mjs` renders the slides (carrosseis.html + the PNGs in
// dezembro-2026/) and the calendar the owner schedules from (dezembro-2026.md);
// test/social.test.js reads this file directly.
//
// Decisions (owner, 26/11/2026, L-45 analysis): the window is DECEMBER (November had run out by
// the time the item started) — Natal, Ano-Novo and the start of the summer holidays, the themes of
// the L-42 articles; no emoji anywhere, captions included (U-31); no price, no competitor, no legal
// advice; every sentence about the product is a claim about the app's code (S-15) and is taken
// from what the L-42 articles' boxes already say; the Reels are recorded by Claude on an emulator
// against the LOCAL stack (L-45 PR 2). Nothing here is posted automatically: the owner owns the
// accounts and schedules each post (Meta Business Suite, Pinterest's own scheduler).
//
// Every carousel slide is ONE of four shapes (see social.mjs): cover, text, quote, list, plus the
// closing cta. Copy is adapted from the articles, never contradicting them; where an article
// gives an example sentence, the slide quotes it as it stands there.

export const MONTH = { year: 2026, month: 12, label: "dezembro de 2026" };

/** The hashtags every caption may draw from — short on purpose (Instagram reads 3–5 best). */
const TAGS = {
  base: ["#guardacompartilhada", "#coparentalidade", "#paisseparados"],
  natal: "#natal",
  ferias: "#feriasescolares",
};

const BLOG = {
  natal: "/blog/natal-e-ano-novo-guarda-compartilhada",
  ferias: "/blog/ferias-escolares-guarda-compartilhada",
  combinar: "/blog/como-combinar-festas-com-o-outro-responsavel",
};

const LEGAL = "Conteúdo informativo, não é aconselhamento jurídico.";

export const POSTS = [
  {
    id: "c01",
    date: "2026-12-01",
    kind: "carousel",
    slug: "natal-tres-jeitos",
    title: "Natal e Ano-Novo em duas casas: 3 jeitos de dividir",
    link: BLOG.natal,
    slides: [
      { type: "cover", kicker: "Festas de fim de ano", title: "Natal e Ano-Novo em duas casas: 3 jeitos de dividir", body: "Nenhum é o certo. Cada um pede um combinado diferente." },
      { type: "text", n: 1, title: "Alternar por ano", body: "Num ano, o Natal fica com uma casa e o Ano-Novo com a outra. No ano seguinte, inverte.", pro: "Cada festa fica inteira, sem deslocamento no meio.", con: "A cada dois anos, cada um passa uma das festas sem a criança." },
      { type: "quote", title: "Amarre a regra ao calendário", quote: "Nos anos pares, o Natal fica com um e o Ano-Novo com o outro; nos ímpares, o contrário.", body: "Escrita assim, com os nomes, a regra não depende da memória de ninguém." },
      { type: "text", n: 2, title: "Separar o dia 24 do dia 25", body: "A noite do dia 24 numa casa, o dia 25 na outra. O mesmo vale para o 31 e o 1º. Quem teve a noite num ano fica com o dia no seguinte.", note: "Combine a troca com folga: “dia 25 às 11h” é mais honesto do que “de manhã cedo”." },
      { type: "text", n: 3, title: "Dividir a semana das festas", body: "A semana do Natal com uma casa, a do Réveillon com a outra, alternando a cada ano. Combina com quem viaja.", note: "Escreva o dia e a hora da troca no meio: “dia 28, ao meio-dia”, e não “depois do Natal”." },
      { type: "list", title: "Como escolher", items: ["A distância entre as casas", "As tradições de cada lado: ceia ou almoço?", "As viagens já marcadas", "O que a criança diz merece ser ouvido; a decisão é dos adultos"] },
      { type: "cta", cta: "guide", title: "O guia completo, com um modelo de cláusula para o acordo" },
    ],
    caption: [
      "Dezembro junta as datas que mais pesam numa rotina de guarda: a ceia, o almoço do dia 25, a virada do ano, a viagem para a casa dos avós.",
      "Os três formatos mais comuns: alternar as festas por ano, separar o dia 24 do dia 25 e dividir a semana das festas em dois blocos. O melhor é o que cabe na distância entre as casas e nas tradições de cada lado.",
      "Qualquer um funciona melhor escrito, com nomes, dias e horários.",
      "O guia completo está no blog do Entrelares (link na bio).",
      LEGAL,
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "c02",
    date: "2026-12-03",
    kind: "carousel",
    slug: "o-que-decidir",
    title: "Ainda dá tempo: o que decidir antes do dia 24",
    link: BLOG.combinar,
    slides: [
      { type: "cover", kicker: "Roteiro das festas", title: "Ainda dá tempo: o que decidir antes do dia 24", body: "Seis pontos para combinar por escrito, com nomes, dias e horários." },
      { type: "text", n: 1, title: "As datas", body: "Quais dias ficam com cada casa: 24, 25, 31 e 1º. E como fica o resto das férias escolares." },
      { type: "text", n: 2, title: "Os horários de troca", body: "A que horas e onde a criança passa de uma casa para a outra, em cada transição." },
      { type: "text", n: 3, title: "As viagens", body: "Quem viaja, para onde e entre quais dias, e como a criança fala com a outra casa durante a viagem." },
      { type: "text", n: 4, title: "Presentes e custos", body: "Presente conjunto ou separado, e quem compra o quê da lista da criança. Em termos gerais, quem paga passagens, ceia e passeios." },
      { type: "text", n: 5, title: "O ano que vem", body: "Se a regra alterna, escrevam desde já quem fica com o quê no próximo ano." },
      { type: "text", n: 6, title: "Tudo isso por escrito", body: "Uma mensagem com o resumo, respondida pelo outro com um “de acordo”, já basta. Não é desconfiança; é memória compartilhada." },
      { type: "cta", cta: "guide", title: "O roteiro completo para combinar as festas" },
    ],
    caption: [
      "A divisão das festas raramente dá errado por falta de modelo. Dá errado porque foi combinada tarde, de boca, e cada um saiu da conversa lembrando de um jeito.",
      "Seis pontos para fechar antes do dia 24: as datas, os horários de troca, as viagens, presentes e custos, e quem fica com o quê no ano que vem.",
      "Se já existe um acordo de guarda, comecem por ele: muitas vezes a regra está lá e falta só aplicá-la ao calendário deste ano.",
      "O roteiro completo está no blog do Entrelares (link na bio).",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "r01",
    date: "2026-12-05",
    kind: "reel",
    slug: "quem-fica-hoje",
    title: "Quem fica com a criança hoje? Os dois veem a mesma resposta",
    caption: [
      "Quem fica com a criança hoje? No Entrelares, os responsáveis veem o mesmo calendário, com quem fica em cada dia e o horário da entrega marcado nos dias de transição.",
      "Os dias de festa são dias do calendário como os outros.",
      "Crie a conta grátis pelo link na bio.",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "c03",
    date: "2026-12-08",
    kind: "carousel",
    slug: "tres-mensagens",
    title: "Três mensagens para combinar as festas sem briga",
    link: BLOG.combinar,
    slides: [
      { type: "cover", kicker: "Roteiro das festas", title: "Três mensagens para combinar as festas sem briga", body: "O que já está combinado, a proposta concreta e uma pergunta aberta." },
      { type: "quote", title: "Para abrir a conversa", quote: "Oi. Pelo nosso acordo, este ano o Natal é meu e o Ano-Novo é seu. Pensei na troca no dia 28, ao meio-dia, na escola, como no ano passado. Funciona para você ou prefere outro dia?" },
      { type: "quote", title: "Para propor uma mudança", quote: "Minha família vai fazer a ceia na casa da minha mãe, em outra cidade, no dia 24. Pelo acordo o dia é seu. Você toparia trocar o 24 pelo 31 só este ano? Se não der, tudo bem, seguimos o combinado." },
      { type: "quote", title: "Para fechar", quote: "Então fica assim: dia 24 e 25 comigo, troca dia 26 às 10h na sua casa; 31 e 1º com você. Confirma que está de acordo?" },
      { type: "list", title: "O que as três evitam", items: ["Justificativa longa", "Cobrança do passado", "Pergunta fechada que soa como ordem"] },
      { type: "list", title: "O que as três têm", items: ["A referência ao acordo", "A data e a hora exatas", "Uma saída honrosa: “se não der, seguimos o combinado”"] },
      { type: "cta", cta: "guide", title: "Mais modelos e o roteiro completo" },
    ],
    caption: [
      "A forma da proposta decide metade da resposta.",
      "Mensagens que funcionam têm três partes: o que já está combinado, a proposta concreta e uma pergunta aberta. E evitam justificativa longa, cobrança do passado e pergunta fechada que soa como ordem.",
      "Salve para adaptar quando for a sua vez de escrever.",
      "O roteiro completo está no blog do Entrelares (link na bio).",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "c04",
    date: "2026-12-10",
    kind: "carousel",
    slug: "ferias-tres-formatos",
    title: "Férias de dezembro e janeiro: 3 formatos para dividir",
    link: BLOG.ferias,
    slides: [
      { type: "cover", kicker: "Férias de verão", title: "Férias de dezembro e janeiro: 3 formatos para dividir", body: "E uma regra que vale para todos." },
      { type: "text", title: "Antes de tudo: o calendário da escola", body: "Marque o último dia de aula e a volta às aulas. As datas mudam de escola para escola e de ano para ano; com o período na mão, dá para contar os dias de verdade." },
      { type: "text", n: 1, title: "Metade e metade", body: "Duas partes iguais; a ordem se inverte a cada ano. É o formato que mais abre espaço para viagens longas.", note: "Se o Natal e o Ano-Novo caem na mesma metade, combinem as festas à parte." },
      { type: "text", n: 2, title: "Semanas alternadas", body: "Blocos de uma semana, ou de duas, revezando entre as casas. Ninguém passa semanas seguidas longe da criança.", note: "O custo é logístico: mais trocas e menos espaço para uma viagem longa." },
      { type: "text", n: 3, title: "Blocos em volta de uma viagem", body: "O bloco da viagem fica com quem viaja; o resto se distribui em volta. No ano seguinte, a outra casa escolhe primeiro.", note: "Combinem até quando cada um precisa informar as datas." },
      { type: "list", title: "Além das datas", items: ["O dia, a hora e o lugar de cada troca", "Quem leva e quem busca", "Como a criança fala com a outra casa", "Com quem ela está na véspera da volta às aulas"] },
      { type: "cta", cta: "guide", title: "O guia completo das férias escolares" },
    ],
    caption: [
      "As férias de verão são o maior período fora da rotina do ano, e costumam engolir também o Natal e o Ano-Novo.",
      "Três formatos que funcionam: metade e metade, semanas alternadas e blocos em volta de uma viagem. Em todos, o primeiro passo é o calendário oficial da escola da criança.",
      "Contar os dias antes de dividir evita a discussão de janeiro.",
      "O guia completo está no blog do Entrelares (link na bio).",
    ],
    hashtags: [...TAGS.base, TAGS.ferias],
  },
  {
    id: "r02",
    date: "2026-12-12",
    kind: "reel",
    slug: "trocar-24-pelo-31",
    title: "Trocar o dia 24 pelo 31 com um pedido, não com uma conversa perdida",
    caption: [
      "Trocar o dia 24 pelo dia 31? No Entrelares, quem pede não muda o dia sozinho: o pedido chega ao outro responsável, que aprova ou recusa.",
      "Ao selecionar no calendário dias de um e do outro na mesma quantidade, o app propõe a troca de uma vez, abrindo um pedido por dia.",
      "Crie a conta grátis pelo link na bio.",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "c05",
    date: "2026-12-15",
    kind: "carousel",
    slug: "viagem-quatro-perguntas",
    title: "Vai viajar com a criança? 4 perguntas para responder antes",
    link: BLOG.natal,
    slides: [
      { type: "cover", kicker: "Viagens de fim de ano", title: "Vai viajar com a criança? 4 perguntas para responder antes", body: "Casa dos avós, praia, outra cidade: o combinado vem antes da mala." },
      { type: "text", n: 1, title: "Quem viaja, para onde e entre quais dias", body: "As datas de ida e de volta, escritas, antes de comprar qualquer passagem." },
      { type: "text", n: 2, title: "Onde e a que horas a criança é entregue na volta", body: "E o que acontece se o voo ou a estrada atrasarem." },
      { type: "text", n: 3, title: "Como a criança fala com a outra casa", body: "Combinem o canal e o horário antes de sair." },
      { type: "text", n: 4, title: "Quem cuida de documentos e autorizações", body: "Viagens, sobretudo para fora do país, podem exigir autorização do outro responsável e documentos da criança." },
      { type: "text", title: "Confirme as regras em vigor", body: "As exigências mudam com a idade, o destino e com quem a criança viaja. Confira nos canais oficiais e com a empresa de transporte; com dúvida ou desacordo, procure um advogado de família." },
      { type: "cta", cta: "guide", title: "O guia completo do Natal e do Ano-Novo" },
    ],
    caption: [
      "Fim de ano é época de viagem. Quatro perguntas para responder antes: quem viaja, para onde e entre quais dias; onde e a que horas a criança é entregue na volta; como ela fala com a outra casa durante a viagem; e quem cuida de documentos e autorizações.",
      "Viagens, sobretudo para fora do país, podem exigir autorização do outro responsável. As regras mudam com a idade, o destino e com quem a criança viaja: confirme as que estão em vigor com antecedência.",
      "O guia completo está no blog do Entrelares (link na bio).",
      LEGAL,
    ],
    hashtags: [...TAGS.base, TAGS.ferias],
  },
  {
    id: "c06",
    date: "2026-12-17",
    kind: "carousel",
    slug: "primeiro-natal",
    title: "O primeiro Natal depois da separação",
    link: BLOG.natal,
    slides: [
      { type: "cover", kicker: "Duas casas", title: "O primeiro Natal depois da separação", body: "É o mais difícil, sobretudo para os adultos. Três coisas ajudam." },
      { type: "text", n: 1, title: "Baixar a régua", body: "Não será o Natal de antes. Uma comemoração menor, com as pessoas certas, vale mais do que a ceia perfeita com o clima tenso." },
      { type: "quote", n: 2, title: "Contar o plano com datas", quote: "Dia 24 você dorme na casa do papai, dia 25 almoça aqui.", body: "A criança lida bem com o que é previsível; sofre com o que é decidido na véspera." },
      { type: "text", n: 3, title: "Combinar o que se diz sobre o outro", body: "Nada de “a mamãe não quis vir”. A criança não precisa saber o que falhou entre os adultos; precisa saber que vai ver os dois." },
      { type: "text", title: "Quem fica sem a criança naquela noite", body: "Não precisa passá-la em silêncio: uma chamada de vídeo em hora combinada, curta e sem cobrança, dá à criança a presença dos dois." },
      { type: "text", title: "E os avós?", body: "O combinado é entre os dois responsáveis. A família de cada um é informada do resultado, e não negocia datas com o outro lado." },
      { type: "cta", cta: "guide", title: "O guia completo do Natal e do Ano-Novo" },
    ],
    caption: [
      "O primeiro fim de ano em duas casas é o mais difícil, para os adultos sobretudo.",
      "Três coisas ajudam: baixar a régua, contar o plano à criança com datas concretas e combinar o que se diz sobre o outro.",
      "E quem passa a festa sem a criança não precisa passá-la em silêncio: uma chamada de vídeo em hora combinada, curta e sem cobrança, já dá a ela a presença dos dois.",
      "O guia completo está no blog do Entrelares (link na bio).",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "r03",
    date: "2026-12-19",
    kind: "reel",
    slug: "horario-da-entrega",
    title: "O horário da entrega, marcado no próprio dia",
    caption: [
      "“Dia 25 às 11h” é mais honesto do que “de manhã cedo”.",
      "No Entrelares, cada dia de transição pode ter o horário da entrega marcado, e os dois responsáveis veem o mesmo horário no mesmo calendário.",
      "Crie a conta grátis pelo link na bio.",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "c07",
    date: "2026-12-22",
    kind: "carousel",
    slug: "quando-muda",
    title: "Quando o combinado das festas muda em cima da hora",
    link: BLOG.combinar,
    slides: [
      { type: "cover", kicker: "Imprevistos", title: "Quando o combinado das festas muda em cima da hora", body: "Voo cancelado, doença, um convite que só aparece em dezembro. Quatro regras simples." },
      { type: "text", n: 1, title: "Peça assim que souber", body: "Não na véspera. Quanto antes o pedido chega, mais fácil é dizer sim." },
      { type: "quote", n: 2, title: "Proponha uma compensação", quote: "Fico com o dia 24 e você com o dia 31." },
      { type: "text", n: 3, title: "Até o sim, vale o combinado original", body: "A mudança só existe depois da resposta. Essa regra impede que um pedido vire fato consumado." },
      { type: "text", n: 4, title: "Registre a resposta", body: "Seja ela sim ou não." },
      { type: "text", title: "No Entrelares, a regra já vem pronta", body: "Trocar um dia abre um pedido para o outro responsável. Enquanto ele não responde, o dia fica congelado. A resposta fica no histórico, com data e autor." },
      { type: "cta", cta: "app", title: "As trocas das festas num pedido que os dois veem" },
    ],
    caption: [
      "Mesmo um combinado bem feito encontra imprevistos.",
      "Quatro regras simples: peça assim que souber; proponha uma compensação; até o outro responder, vale o combinado original; e registre a resposta, seja ela sim ou não.",
      "No Entrelares, trocar um dia abre um pedido que o outro responsável aprova ou recusa, e cada resposta fica no histórico com data e autor.",
      "Crie a conta grátis pelo link na bio.",
    ],
    hashtags: [...TAGS.base, TAGS.natal],
  },
  {
    id: "r04",
    date: "2026-12-26",
    kind: "reel",
    slug: "tudo-no-historico",
    title: "Cada pedido, aceite e recusa, com data e autor",
    caption: [
      "Depois das festas, ninguém precisa lembrar quem trocou o quê.",
      "No Entrelares, cada pedido de troca, aceite e recusa fica registrado com data e autor, e ninguém o reescreve depois.",
      "Crie a conta grátis pelo link na bio.",
    ],
    hashtags: [...TAGS.base, TAGS.ferias],
  },
  {
    id: "c08",
    date: "2026-12-29",
    kind: "carousel",
    slug: "ferias-cinco-linhas",
    title: "Duas casas, uma criança: o essencial das férias em cinco linhas",
    link: BLOG.ferias,
    slides: [
      { type: "cover", kicker: "Férias de verão", title: "Duas casas, uma criança: o essencial das férias em cinco linhas", body: "Férias desorganizam horários, e tudo bem. O que pesa é outra coisa." },
      { type: "text", title: "O que pesa para a criança", body: "Regras muito diferentes na mesma semana: dormir às 21h numa casa e à 1h na outra, tela livre de um lado e proibida do outro." },
      { type: "list", title: "As cinco linhas", items: ["Hora aproximada de dormir", "Tempo de tela", "Refeições", "Protetor solar", "Remédios"] },
      { type: "text", title: "O resto, cada casa decide", body: "Não é padronizar as casas; é poupar a criança da readaptação a cada troca." },
      { type: "text", title: "Na última semana de férias", body: "Quem está com a criança traz os horários de volta: acordar mais cedo, dormir mais cedo, conferir material e uniforme." },
      { type: "text", title: "A véspera da volta às aulas", body: "Combinem com antecedência com quem a criança está nesse dia, e quem fica com a lista de material." },
      { type: "cta", cta: "guide", title: "O guia completo das férias escolares" },
    ],
    caption: [
      "Férias desorganizam horários por natureza, e tudo bem. O que pesa para a criança é quando as duas casas têm regras muito diferentes para a mesma semana.",
      "Vale alinhar o essencial em cinco linhas: hora aproximada de dormir, tempo de tela, refeições, protetor solar e remédios. O resto, cada casa decide.",
      "E combinem desde já com quem a criança está na véspera do primeiro dia de aula.",
      "O guia completo está no blog do Entrelares (link na bio).",
    ],
    hashtags: [...TAGS.base, TAGS.ferias],
  },
];

/** The closing slide's two variants: back to an article, or to the app. */
export const CTA = {
  guide: { line: "No blog do Entrelares", action: "Link na bio" },
  app: { line: "Entrelares: o calendário da guarda compartilhada", action: "Crie a conta grátis: link na bio" },
};

/** The brand line under every closing slide — each clause is a fact about the app (S-15). */
export const BRAND_LINE = "Quem fica com a criança em cada dia, trocas que o outro responsável aprova e histórico com data.";
