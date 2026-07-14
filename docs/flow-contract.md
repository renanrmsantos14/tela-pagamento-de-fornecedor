# Contrato do Flow de Pagamentos a Terceiros

O web resource chama o Flow com `POST` e este corpo:

```json
{
  "loteId": "GUID_DO_LOTE",
  "operacao": "enviar",
  "versao": 1,
  "contratoOneDrive": "new_FlowURLFlowSalvarArquivosOnedrive"
}
```

`operacao` aceita `enviar`, `reenviar` e `gerar-final-pago`.

O Flow deve:

1. Buscar o lote em `cr40f_pagamentoaterceiro` e os itens em `cr40f_itempagamentoaterceiro`.
2. Montar o PDF operacional com identificador do serviço, data, cliente, trajeto, valor cobrado, repasse e margem.
3. Salvar o PDF no OneDrive usando o contrato existente `new_FlowURLFlowSalvarArquivosOnedrive` com `caminhoCompleto`, `nomeArquivo`, `conteudoBase64`, `mimeType`, `metadados` e link compartilhável.
4. Enviar ao e-mail congelado do Terceiro Favorecido com cópia para Financeiro Betinhos.
5. Registrar o evento no `cr40f_eventopagamentoaterceiro`.
6. Se a notificação final falhar depois do PIX, manter o lote como `Pago`, gravar `ErroNotificacao` e permitir nova tentativa.

O web resource não calcula repasse a partir de uma coluna legada. O valor deve vir de `cr40f_valorrepasseterceiro` na composição do serviço e ser congelado em `cr40f_valorrepasse` no item do lote.

Nota de metadata DEV: o MCP não expôs `cr40f_reservadeveiculos` para criação de lookup na tabela de itens. Por isso, o item mantém `cr40f_servicoid` como identificador textual do serviço, além do snapshot financeiro. O lookup nativo deve ser adicionado quando a entidade estiver disponível no cache de metadata.
