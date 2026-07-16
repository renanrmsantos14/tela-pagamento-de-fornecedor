# Contratos de Flow

## Enviar documento do lote ao fornecedor

O botão `Enviar documento do lote` gera
`Pagamento_<LOTE>_v<VERSAO>.pdf`, salva uma cópia no OneDrive e envia o mesmo
conteúdo ao Flow. O e-mail recebe o arquivo real no campo `ContentBytes`; não
recebe link do OneDrive.

### URL por ambiente

O app resolve a URL HTTP pela variável de ambiente Dataverse:

`new_FlowURLEnviarDocumentoLoteFornecedor`

O schema name é igual em DEV, HOM e PROD. Apenas o valor corrente muda em cada
ambiente. Não existe URL fixa no bundle. Para prévia local, o fallback opcional é:

```js
window.__APP_FLOW_ENV = Object.freeze({
  VITE_FLOW_ENVIAR_DOCUMENTO_LOTE_URL: "https://...",
});
```

### Body enviado pelo app

```json
{
  "contrato": "new_FlowURLEnviarDocumentoLoteFornecedor.v1",
  "loteId": "<guid>",
  "identificadorLote": "PT-2026-0001",
  "versao": 1,
  "destinatario": "fornecedor@empresa.com.br",
  "nomeFavorecido": "Fornecedor",
  "assunto": "Betinhos | Documento do lote PT-2026-0001",
  "corpoHtml": "<p>...</p>",
  "nomeArquivo": "Pagamento_PT-2026-0001_v1.pdf",
  "conteudoBase64": "<PDF base64>",
  "mimeType": "application/pdf"
}
```

Resposta obrigatória:

```json
{
  "ok": true,
  "emailId": "<workflow run id>",
  "loteId": "<guid>"
}
```

O `emailId` fica em `cr40f_documentoemailid` e no evento de auditoria.

### ALM

- definição: `automation/enviar-documento-lote.json`;
- provisionamento: `npm run provision:flow`;
- solução: `appbetinhos`;
- conector: Office 365 Outlook por connection reference encontrada no ambiente;
- ação: `Send an email (V2)`;
- anexo: `Name` + `ContentBytes`;
- variável URL: criada/adicionada à solução pelo provisionador.

O provisionador detecta o ambiente Power Platform, consulta a URL do gatilho
HTTP na região correta e grava o valor corrente automaticamente:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/provision-flow.ps1 `
  -EnvironmentUrl https://org.crm.dynamics.com/
```

`-TriggerUrl "https://..."` permanece como fallback explícito caso a API de
gerenciamento do Power Automate esteja indisponível.

Troca de ambiente exige somente nova autenticação/conexão e novo valor corrente
da variável. App e definição do Flow não mudam.

## Armazenamento no OneDrive

O upload usa a variável Dataverse
`new_FlowURLFlowSalvarArquivosOnedrive` e envia `caminhoCompleto`,
`nomeArquivo`, `conteudoBase64`, `mimeType` e `metadados`.

O caminho é:

`Pagamentos a Terceiros/<ANO>/<FAVORECIDO>/<LOTE>/`

O retorno precisa conter `shareLink`, `webUrl`, `url` ou `link`.

Falha de armazenamento ou e-mail não desfaz pagamento. O documento fica como
falha, o erro é auditado e o botão permite nova tentativa.
