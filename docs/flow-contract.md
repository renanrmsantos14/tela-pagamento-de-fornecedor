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

## Configuração da URL do Flow

O app busca primeiro a variável de ambiente Dataverse
`new_FlowURLFlowSalvarArquivosOnedrive`. Em seguida, usa o fallback de runtime
do mesmo padrão do App Motoristas:

```js
window.__APP_FLOW_ENV = Object.freeze({
  VITE_FLOW_SALVAR_ARQUIVOS_ONEDRIVE_URL: "https://...",
});
```

`window.__PAYMENT_RUNTIME_CONFIG.oneDriveFlowUrl`, `__ONEDRIVE_FLOW_URL` e
`__PAYMENT_FLOW_URL` permanecem como compatibilidade. Sem URL, o app interrompe
o salvamento com erro explícito.
O retorno do Flow precisa ser JSON com `webUrl`, `url` ou `link` e, opcionalmente,
`name`.
