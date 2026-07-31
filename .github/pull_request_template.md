<!-- Modelo de PR — guardacompartilhada.com (landing). Preencha o que se aplica e apague o resto.
     Fluxo: feature → PR → `preview` (QA, auto-deploy em preview.guardacompartilhada.com).
     Promoção `preview`→`main` (produção) é SOB DEMANDA, só a pedido explícito. -->

## Contexto
<!-- Por que a mudança existe. Item do ROADMAP (L-NN) e/ou issue. -->

## Mudanças
-

## Tipo
- [ ] feat/fix (conteúdo ou comportamento do site)
- [ ] docs/chore (ROADMAP/README/CLAUDE — não servido)
- [ ] Worker endpoint (`src/index.js` — /api/subscribe)

## Testes (Worker)
<!-- Só se tocou src/index.js. Estático/HTML não afeta a suíte. -->
- [ ] N/A (estático/HTML)
- [ ] `npm test` verde (test/subscribe.test.js)

## Sync legal (se tocou privacidade/termos)
<!-- privacidade.html/termos.html devem espelhar o app na MESMA entrega;
     bump "Última atualização" + "Versão N.N" nos dois lados quando material. -->
- [ ] N/A
- [ ] Espelhado no app + datas/versão bumpados

## Checklist
- [ ] Branch criada do `preview` atual (não reusa branch mesclada)
- [ ] Copy/legal em PT-BR
- [ ] Roadmap atualizado (registro em `ROADMAP.md` + linha no Notion)
- [ ] Sem segredos (RESEND_API_KEY etc.) no diff
- [ ] Ciente: merge em `preview` ≠ produção; `main` só sob demanda

## Itens entregues
<!-- MANTENHA ESTA SEÇÃO NO FIM DO CORPO. O GitHub pré-preenche a mensagem do commit de
     squash com o corpo do PR, então a linha abaixo vira o trailer do commit sozinha.
     Só itens que ESTE PR entrega — itens citados como contexto ficam na prosa acima e
     nunca contam como entrega. Vários itens: `Backlog: L-04, L-07`.
     Sem item de roadmap (ajuste de infra, dependência)? Apague a linha. -->

Backlog: L-NN
