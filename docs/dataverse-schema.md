# Contrato Dataverse — Pagamentos a Terceiros

## Fonte financeira

`cr40f_composicaodeprecos.cr40f_valorrepasseterceiro` é a única fonte do repasse.
Não usar `cr40f_valorhoramotorista` nem `cr40f_valorrepasseterceiro_base`.

Campos obrigatórios adicionais na composição:

- `cr40f_terceirofavorecido` (lookup para `cr40f_terceirofavorecido`)
- `cr40f_pagamentoaterceiro` (lookup para `cr40f_pagamentoaterceiro`)

Auditar os três campos acima. Limpar o lookup de lote no cancelamento; manter no pagamento.

## Tabelas

### `cr40f_terceirofavorecido`

`cr40f_nomerazaosocial`, `cr40f_tipopessoa`, `cr40f_cpfcnpj`,
`cr40f_tipochavepix`, `cr40f_chavepix`, `cr40f_email`, `cr40f_telefone` e
`cr40f_status` (Ativo/Inativo). Criar chaves alternativas únicas para CPF/CNPJ
normalizado e chave PIX normalizada.

### `cr40f_vinculomotoristafavorecido`

Lookups `cr40f_motorista` para `cr40f_funcionarios` e
`cr40f_terceirofavorecido`; choice `cr40f_status` (Ativo/Inativo). Criar chave
alternativa composta por motorista + favorecido. O cliente reativa o vínculo
existente, nunca duplica.

### `cr40f_pagamentoaterceiro`

`cr40f_statuslote`, `cr40f_statuspagamento`, `cr40f_statusdocumento`,
`cr40f_pagoem`, `cr40f_pagopor`, `cr40f_comprovanteurl`, `cr40f_canceladoem`,
`cr40f_motivocancelamento`, `cr40f_pagamentorevertidoem`,
`cr40f_motivoreversaopagamento`, `cr40f_documentourl`,
`cr40f_documentonome`, `cr40f_documentoversao`, `cr40f_documentoemailid`,
`cr40f_errodocumento`, `cr40f_snapshotfavorecido`,
`cr40f_emailfavorecidoenvio`, `cr40f_totalcobradocliente`,
`cr40f_totalrepasse`, `cr40f_margemtotal`, `cr40f_quantidadeservicos`,
`cr40f_identificadorlote` e `cr40f_anoreferencia`.

Choices normalizados no cliente:

- lote: `draft`, `cancelled`
- pagamento: `open`, `paid`
- documento: `not_generated`, `sending`, `sent`, `failed`, `resend_required`

### Itens e eventos

`cr40f_itempagamentoaterceiro` precisa guardar o lookup da composição original,
lookup do lote, reserva/serviço, data, motorista, trajeto, valores congelados e
snapshot JSON financeiro. `cr40f_eventopagamentoaterceiro` precisa guardar
operação, resultado, estados, motivo, mensagem, detalhe técnico, versão, URL e
ID do e-mail. Use `createdby` e `createdon` como autoria e horário oficiais.

## Publicação DEV

Este repositório valida o mock e prepara o adaptador Web API. Antes de publicar,
crie as colunas na solução correta, habilite auditoria e execute o provisionamento
de forma idempotente no DEV. Depois valide metadata, Queue `Financeiro Betinhos`,
mailbox aprovada e o Flow `new_FlowURLFlowSalvarArquivosOnedrive`.
