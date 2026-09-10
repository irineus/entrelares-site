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
- [ ] Card do Notion atualizado (`Status`, `Conclusão`, `Notas`) — `ROADMAP.md` é história, não se edita
- [ ] Sem segredos (RESEND_API_KEY etc.) no diff
- [ ] Ciente: merge em `preview` ≠ produção; `main` só sob demanda

## Itens entregues
<!-- Desde o app T-63 (07/09/2026) NÃO existe mais o trailer `Backlog:` — o seu único leitor,
     o gerador do espelho, foi apagado. Nomeie o item aqui em prosa, para quem lê o `git log`,
     e feche o card no Notion (Status, Conclusão, Notas), que é o registro. -->

L-NN — <o que este PR entrega>
