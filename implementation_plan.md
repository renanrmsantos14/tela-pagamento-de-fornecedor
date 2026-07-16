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

---

# Plano de performance - 15 jul 2026

## Objetivo

Reduzir custo de renderizacao, busca e atualizacao de dados em todo o app sem alterar fluxo, layout, scroll horizontal fixo ou contratos Dataverse.

## Evidencias de base

- Build atual: 1.076,04 kB de JavaScript minificado (329,73 kB gzip) e 288,86 kB de CSS.
- O webresource incorpora todos os assets em um unico HTML. `inlineDynamicImports` impede ganho real com code splitting comum; nao alterar este contrato nesta rodada.
- A grade calcula vinculo em cada celula, recria opcoes de favorecido por linha e reprocessa a lista em atualizacoes que nao mudam os servicos.
- Troca de periodo busca novamente dados de referencia que nao dependem do intervalo.

## Arquivos

- `[MODIFY] src/App.jsx`
  - estabilizar callbacks e dados derivados usados pela tela de repasses;
  - adiar filtro textual nao urgente para manter digitacao responsiva;
  - separar recarga de servicos da recarga de referencias; carga inicial, botao Atualizar e mutacoes continuam recarregando tudo;
  - memoizar linhas da grade e passar somente primitivas/refs estaveis para impedir re-render de linhas nao alteradas;
  - criar Map/Set memoizados para favorecidos e vinculos ativos, removendo buscas repetidas por celula;
  - reutilizar uma unica lista de opcoes de favorecido em todas as linhas.
- `[MODIFY] src/SearchableSelect.jsx`
  - aplicar memoizacao de componente para seletores fechados nao recalcularem opcoes quando props estaveis.
- `[MODIFY] src/styles.css`
  - isolar pintura da linha da grade apenas onde nao interfere em colunas sticky, menus ou foco; preservar todas as dimensoes e transicoes atuais.
- `[MODIFY] task.md`
  - registrar checklist de execucao e validacao desta rodada.

## Criterios de aceite

1. Scroll horizontal fixo permanece visivel no extremo sul e sincronizado com a grade.
2. Salvar repasse ou vincular favorecido atualiza somente a linha afetada, sem reinicializar drafts das demais.
3. Filtro textual permanece funcional e a digitacao nao bloqueia a interface enquanto a grade e recalculada.
4. Trocar datas deixa de recarregar favorecidos, motoristas, vinculos e lotes; Atualizar e operacoes que mudam dados continuam recarregando referencias.
5. `npm test`, `npm run build` e `git diff --check` passam.
6. Bundle final nao aumenta; o aviso de chunk unico permanece documentado como limitacao do formato de webresource.

## Riscos controlados

- Nao usar virtualizacao de linhas nesta rodada: ela desmontaria inputs e seletores durante a rolagem, podendo perder rascunhos.
- Nao alterar `inlineDynamicImports` ou o empacotamento em HTML unico: isso quebraria carregamento do webresource no Dataverse.
- Invalidar referencias em todas as mutacoes e no botao Atualizar para evitar dados operacionais defasados.

---

# Plano - envio do documento do lote por e-mail

## Objetivo

Adicionar acao explicita para enviar ao favorecido o PDF real do lote como anexo,
usando Flow solution-aware e configuracao portavel entre ambientes.

## Arquivos

- `[MODIFY] src/App.jsx`
  - adicionar botao `Enviar documento do lote`;
  - gerar o PDF, salvar copia no OneDrive, chamar o Flow de e-mail e exibir estado.
- `[MODIFY] src/lib/dataverse.js`
  - resolver `new_FlowURLEnviarDocumentoLoteFornecedor` no Dataverse;
  - enviar contrato HTTP com destinatario e PDF em base64;
  - persistir ID da execucao/e-mail e auditoria no lote.
- `[MODIFY] src/styles.css`
  - diferenciar a acao de envio sem alterar o drawer.
- `[MODIFY] tests/mock-flow.test.js`
  - validar URL por variavel de ambiente, payload do anexo e retorno.
- `[MODIFY] docs/flow-contract.md`
  - documentar contrato, ALM, connection reference e ativacao por ambiente.
- `[NEW] power-automate/enviar-documento-lote/*`
  - manter schema HTTP e definicao versionada do Flow.

## Criterios de aceite

1. O app nao envia link: `conteudoBase64` do PDF segue no body do Flow.
2. O Flow usa `Send an email (V2)` com `Name` e `ContentBytes`.
3. URL do gatilho nao fica fixa no app; vem da variavel Dataverse.
4. Conexao Outlook fica em connection reference da solucao.
5. Falha de e-mail nao desfaz pagamento e fica auditada.
6. `npm test`, `npm run build` e `git diff --check` passam.
