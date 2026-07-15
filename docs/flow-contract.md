# Contrato de documento e envio

Após o pagamento, o navegador gera `Pagamento_<LOTE>_v<VERSAO>.pdf` com jsPDF.
O documento externo contém somente identificação Betinhos, lote/versão, datas,
favorecido, CPF/CNPJ, PIX, serviços, motoristas, trajetos, repasses e total.
Não contém cliente, receita, lucro, margem, observações internas ou link OneDrive.

O upload faz POST para `window.__ONEDRIVE_FLOW_URL` (ou fallback explícito
`window.__PAYMENT_FLOW_URL`) com `caminhoCompleto`, `nomeArquivo`,
`conteudoBase64`, `mimeType` e `metadados`. O caminho é
`Pagamentos a Terceiros/<ANO>/<FAVORECIDO>/<LOTE>/`.

O envio Dataverse usa `window.__FINANCE_QUEUE_ID` e
`window.__FINANCE_COPY_EMAIL`, cria e-mail, anexo `activitymimeattachment` e
executa `SendEmail`. Falha de upload/e-mail não desfaz pagamento: document status
fica `failed` e o reenvio é permitido.

## Configuração runtime obrigatória

Antes de abrir o web resource, o host deve injetar os três valores abaixo.
O objeto é somente de runtime e não deve ser gravado no repositório:

```js
window.__PAYMENT_RUNTIME_CONFIG = Object.freeze({
  oneDriveFlowUrl: "https://...",
  financeQueueId: "GUID-da-queue",
  financeCopyEmail: "financeiro@empresa.com.br",
});
```

Os nomes legados `__ONEDRIVE_FLOW_URL`, `__PAYMENT_FLOW_URL`,
`__FINANCE_QUEUE_ID` e `__FINANCE_COPY_EMAIL` continuam aceitos. Sem URL do
Flow, Queue ou e-mail de cópia, o app interrompe o envio com erro explícito.
O retorno do Flow precisa ser JSON com `url` ou `link` e, opcionalmente,
`name`.
