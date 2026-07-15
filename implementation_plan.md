# Plano de correção — Pagamento de Fornecedores

## Objetivo

Remover os bloqueios de produção do fluxo remoto Dataverse sem alterar o contrato visual nem o comportamento do mock.

## Arquivos

- `[MODIFY] src/lib/dataverse.js`
  - corrigir o navigation property do lookup `cr40f_Motorista`;
  - separar normalização de registros remotos de pagamento, itens e eventos;
  - criar itens e vincular composições ao lote durante a reserva;
  - implementar leitura remota de detalhe e eventos;
  - completar edição, cancelamento, pagamento, reversão e resultado documental no Dataverse;
  - resolver configuração de Flow/fila com erro explícito e proteger respostas HTTP inválidas.
- `[MODIFY] src/App.jsx`
  - tratar falhas dos callbacks de vínculo para eliminar `Uncaught (in promise)`;
  - manter estado de carregamento e mensagem de erro sem duplicar operações.
- `[MODIFY] tests/mock-flow.test.js`
  - adicionar teste de contrato do payload de lookup;
  - cobrir o fluxo remoto com `fetch` simulado, incluindo normalização de lotes, detalhe e transições.
- `[MODIFY] docs/flow-contract.md`
  - documentar a origem obrigatória da configuração runtime e o contrato de retorno do Flow.

## Critérios de aceite

1. O payload de criação de vínculo usa `cr40f_Motorista@odata.bind` e `cr40f_TerceiroFavorecido@odata.bind`.
2. Lote remoto criado possui cabeçalho, itens, vínculos de composição e eventos auditáveis.
3. A lista remota entrega os mesmos campos normalizados usados pelo mock/UI.
4. Detalhe, edição, cancelamento, pagamento, reversão e reenvio documental funcionam sem depender do mock.
5. Erros de vínculo aparecem no componente sem rejeição não tratada.
6. `npm test`, `npm run build`, `git diff --check` e validação de sintaxe do deploy passam.
7. Publicação real no Dataverse continua sendo declarada separadamente até existir autenticação e metadata viva disponíveis.

## Riscos controlados

- Não inventar nomes lógicos, choices ou navigation properties: usar contratos existentes no código e no provisionamento.
- Não tocar na alteração preexistente não commitada em `src/lib/dataverse.js` além dos hunks necessários ao escopo aprovado.
- Não executar `npm run push` nem operações destrutivas no Dataverse durante validação local.
