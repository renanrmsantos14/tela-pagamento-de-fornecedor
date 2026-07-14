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
