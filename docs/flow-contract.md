# Contrato de documento e armazenamento

Após o pagamento, o navegador gera `Pagamento_<LOTE>_v<VERSAO>.pdf` com jsPDF.
O documento externo contém somente identificação Betinhos, lote/versão, datas,
favorecido, CPF/CNPJ, PIX, serviços, motoristas, trajetos, repasses e total.
Não contém cliente, receita, lucro, margem, observações internas ou link OneDrive.

O upload faz POST para `window.__ONEDRIVE_FLOW_URL` (ou fallback explícito
`window.__PAYMENT_FLOW_URL`) com `caminhoCompleto`, `nomeArquivo`,
`conteudoBase64`, `mimeType` e `metadados`. O caminho é
`Pagamentos a Terceiros/<ANO>/<FAVORECIDO>/<LOTE>/`.

O app inicia o download local logo após o Flow confirmar o salvamento. Não cria
e-mail, anexo `activitymimeattachment` nem executa `SendEmail`. Falha de upload
não desfaz pagamento: document status fica `failed` e o reenvio é permitido.

## Configuração runtime obrigatória

Antes de abrir o web resource, o host deve injetar a URL abaixo.
O objeto é somente de runtime e não deve ser gravado no repositório:

```js
window.__PAYMENT_RUNTIME_CONFIG = Object.freeze({
  oneDriveFlowUrl: "https://...",
});
```

Os nomes legados `__ONEDRIVE_FLOW_URL` e `__PAYMENT_FLOW_URL` continuam
aceitos. Sem URL do Flow, o app interrompe o salvamento com erro explícito.
O retorno do Flow precisa ser JSON com `url` ou `link` e, opcionalmente,
`name`.
