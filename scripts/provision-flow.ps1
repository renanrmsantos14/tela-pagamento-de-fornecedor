param(
  [Parameter(Mandatory = $true)][string]$EnvironmentUrl,
  [string]$SolutionUniqueName = 'appbetinhos',
  [string]$FlowName = 'Pagamento de Fornecedores - Enviar documento do lote',
  [string]$DefinitionPath = '',
  [string]$TriggerUrl = '',
  [string]$EnvironmentVariableSchemaName = 'new_FlowURLEnviarDocumentoLoteFornecedor',
  [switch]$DeviceCode
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($DefinitionPath)) {
  $DefinitionPath = Join-Path $PSScriptRoot '..\automation\enviar-documento-lote.json'
}

function Step($message) { Write-Host "[provision-flow] $message" }
function OData($value) { return ([string]$value).Replace("'", "''") }
function Scoped-Token($scope, [switch]$UseDeviceCode) {
  if (-not (Get-Module -ListAvailable MSAL.PS)) {
    throw 'MSAL.PS não encontrado. Instale: Install-Module MSAL.PS -Scope CurrentUser'
  }
  Import-Module MSAL.PS -ErrorAction Stop
  $client = New-MsalClientApplication -ClientId '51f81489-12ee-4a9e-aaae-a2591f45987d' -TenantId 'organizations' -RedirectUri ([Uri]'http://localhost')
  Enable-MsalTokenCacheOnDisk -PublicClientApplication $client | Out-Null
  try {
    return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Silent).AccessToken
  } catch {
    if ($UseDeviceCode) {
      return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -DeviceCode).AccessToken
    }
    return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Interactive).AccessToken
  }
}
function Token($url, [switch]$UseDeviceCode) {
  return Scoped-Token "$url/user_impersonation" $UseDeviceCode
}
function Request($method, $path, $body = $null) {
  $arguments = @{ Method = $method; Uri = "$base/$path"; Headers = $headers }
  if ($null -ne $body) {
    $arguments.ContentType = 'application/json; charset=utf-8'
    $arguments.Body = ($body | ConvertTo-Json -Depth 100 -Compress)
  }
  return Invoke-RestMethod @arguments
}
function Ensure-EnvironmentVariable($schemaName, $value) {
  $escapedSchema = OData $schemaName
  $definitions = @((Request 'GET' "environmentvariabledefinitions?`$select=environmentvariabledefinitionid,schemaname,type&`$filter=schemaname eq '$escapedSchema'").value)
  if ($definitions.Count -gt 1) { throw "Mais de uma variável encontrada: $schemaName" }
  if ($definitions.Count -eq 0) {
    Step "create environment variable $schemaName"
    $definition = Request 'POST' 'environmentvariabledefinitions' @{
      schemaname = $schemaName
      displayname = 'Flow - Enviar documento do lote ao fornecedor'
      description = 'URL HTTP do Flow que envia o PDF real do lote por e-mail.'
      type = 100000000
    }
    $definitionId = [string]$definition.environmentvariabledefinitionid
    if (-not $definitionId) { throw 'Dataverse não retornou environmentvariabledefinitionid.' }
    Request 'POST' 'AddSolutionComponent' @{
      ComponentId = $definitionId
      ComponentType = 380
      SolutionUniqueName = $SolutionUniqueName
      AddRequiredComponents = $true
      DoNotIncludeSubcomponents = $false
      IncludedComponentSettingsValues = $null
    } | Out-Null
  } else {
    $definitionId = [string]$definitions[0].environmentvariabledefinitionid
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    Step "environment variable kept without value: $schemaName"
    return
  }
  $values = @((Request 'GET' "environmentvariablevalues?`$select=environmentvariablevalueid,value&`$filter=_environmentvariabledefinitionid_value eq $definitionId").value)
  if ($values.Count -gt 1) { throw "Mais de um valor corrente encontrado para $schemaName." }
  if ($values.Count -eq 1) {
    Step "update environment variable value"
    Request 'PATCH' "environmentvariablevalues($($values[0].environmentvariablevalueid))" @{ value = $value.Trim() } | Out-Null
  } else {
    Step "create environment variable value"
    Request 'POST' 'environmentvariablevalues' @{
      value = $value.Trim()
      'EnvironmentVariableDefinitionId@odata.bind' = "/environmentvariabledefinitions($definitionId)"
    } | Out-Null
  }
}
function Resolve-TriggerUrl($environmentUrl, $flowUniqueId) {
  Step 'resolve environment and HTTP trigger URL'
  $bapToken = Scoped-Token 'https://api.bap.microsoft.com/.default' $DeviceCode
  $bapHeaders = @{ Authorization = "Bearer $bapToken"; Accept = 'application/json' }
  $environments = Invoke-RestMethod -Uri 'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01' -Headers $bapHeaders
  $targetUrl = "$($environmentUrl.TrimEnd('/'))/"
  $environment = @($environments.value | Where-Object {
    [string]$_.properties.linkedEnvironmentMetadata.instanceUrl -eq $targetUrl
  })
  if ($environment.Count -ne 1) {
    throw "Ambiente Power Platform não resolvido para $targetUrl"
  }
  $location = [string]$environment[0].location
  if ([string]::IsNullOrWhiteSpace($location)) {
    throw 'Região do ambiente Power Platform não encontrada.'
  }
  $flowToken = Scoped-Token 'https://service.flow.microsoft.com//.default' $DeviceCode
  $flowHeaders = @{
    Authorization = "Bearer $flowToken"
    Accept = 'application/json'
    'Content-Type' = 'application/json'
  }
  $environmentId = [string]$environment[0].name
  $callbackEndpoint = "https://$location.api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/$environmentId/flows/$flowUniqueId/triggers/manual/listCallbackUrl?api-version=2016-11-01"
  $callback = Invoke-RestMethod -Method Post -Uri $callbackEndpoint -Headers $flowHeaders
  $value = [string]$callback.response.value
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw 'API do Power Automate não retornou a URL do gatilho HTTP.'
  }
  return $value
}

$url = $EnvironmentUrl.TrimEnd('/')
$base = "$url/api/data/v9.2"
$token = Token $url $DeviceCode
$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version' = '4.0'
  Prefer = 'return=representation'
  'MSCRM.SolutionUniqueName' = $SolutionUniqueName
}

$definition = Get-Content -LiteralPath (Resolve-Path $DefinitionPath) -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $definition.schemaVersion) { throw 'schemaVersion precisa estar na raiz da definição.' }
if (-not $definition.properties.PSObject.Properties.Name.Contains('templateName')) {
  throw 'templateName precisa estar em properties.'
}

$templates = @((Request 'GET' "workflows?`$select=workflowid,category,type,primaryentity,scope,mode,runas,modernflowtype,statecode,statuscode,clientdata&`$filter=primaryentity eq 'none' and clientdata ne null&`$top=250").value)
$template = $null
$officeConnectionReference = ''
foreach ($candidate in $templates) {
  try {
    $candidateDefinition = $candidate.clientdata | ConvertFrom-Json
    $office = $candidateDefinition.properties.connectionReferences.shared_office365
    if ($office -and $office.connection.connectionReferenceLogicalName) {
      $template = $candidate
      $officeConnectionReference = [string]$office.connection.connectionReferenceLogicalName
      break
    }
  } catch {}
}
if (-not $template -or [string]::IsNullOrWhiteSpace($officeConnectionReference)) {
  throw 'Nenhum Cloud Flow com conexão Office 365 foi encontrado neste ambiente para resolver a connection reference.'
}
$definition.properties.connectionReferences.shared_office365.connection.connectionReferenceLogicalName = $officeConnectionReference
$clientData = $definition | ConvertTo-Json -Depth 100 -Compress

$stateMetadata = Request 'GET' "EntityDefinitions(LogicalName='workflow')/Attributes(LogicalName='statecode')/Microsoft.Dynamics.CRM.StateAttributeMetadata?`$select=LogicalName&`$expand=OptionSet"
$statusMetadata = Request 'GET' "EntityDefinitions(LogicalName='workflow')/Attributes(LogicalName='statuscode')/Microsoft.Dynamics.CRM.StatusAttributeMetadata?`$select=LogicalName&`$expand=OptionSet"
$draftState = $stateMetadata.OptionSet.Options | Where-Object { $_.InvariantName -eq 'Draft' -or $_.Label.UserLocalizedLabel.Label -match 'Draft|Rascunho' } | Select-Object -First 1
$activeState = $stateMetadata.OptionSet.Options | Where-Object { $_.InvariantName -eq 'Activated' -or $_.Label.UserLocalizedLabel.Label -match 'Activated|Ativado' } | Select-Object -First 1
if (-not $draftState -or -not $activeState) { throw 'Não foi possível resolver estados Draft/Activated do workflow.' }
$draftStatus = $statusMetadata.OptionSet.Options | Where-Object { $_.State -eq $draftState.Value } | Select-Object -First 1
$activeStatus = $statusMetadata.OptionSet.Options | Where-Object { $_.State -eq $activeState.Value } | Select-Object -First 1
if (-not $draftStatus -or -not $activeStatus) { throw 'Não foi possível resolver status Draft/Activated do workflow.' }

$escapedName = OData $FlowName
$existing = @((Request 'GET' "workflows?`$select=workflowid,name,statecode,statuscode&`$filter=name eq '$escapedName'").value)
if ($existing.Count -gt 1) { throw "Mais de um Cloud Flow encontrado: $FlowName" }
$body = @{
  name = $FlowName
  category = [int]$template.category
  type = [int]$template.type
  primaryentity = [string]$template.primaryentity
  scope = [int]$template.scope
  mode = [int]$template.mode
  runas = [int]$template.runas
  ondemand = $false
  modernflowtype = [int]$template.modernflowtype
  clientdata = $clientData
  description = 'Recebe o PDF do lote em base64 e envia o arquivo real ao fornecedor pelo Office 365 Outlook.'
}
if ($existing.Count) {
  $flowId = [string]$existing[0].workflowid
  if ([int]$existing[0].statecode -eq [int]$activeState.Value) {
    Step 'deactivate existing flow'
    Request 'PATCH' "workflows($flowId)" @{ statecode = [int]$draftState.Value; statuscode = [int]$draftStatus.Value } | Out-Null
  }
  Step "update flow $flowId"
  Request 'PATCH' "workflows($flowId)" $body | Out-Null
} else {
  Step 'create flow'
  $created = Request 'POST' 'workflows' $body
  $flowId = [string]$created.workflowid
  if (-not $flowId) { throw 'Dataverse não retornou workflowid ao criar o Cloud Flow.' }
}

Step 'activate flow'
Request 'PATCH' "workflows($flowId)" @{ statecode = [int]$activeState.Value; statuscode = [int]$activeStatus.Value } | Out-Null
$solution = @((Request 'GET' "solutions?`$select=solutionid&`$filter=uniquename eq '$(OData $SolutionUniqueName)'").value)
if ($solution.Count -ne 1) { throw "Solução não encontrada: $SolutionUniqueName" }
$component = @((Request 'GET' "solutioncomponents?`$select=solutioncomponentid&`$filter=_solutionid_value eq $($solution[0].solutionid) and objectid eq $flowId").value)
if (-not $component.Count) {
  Request 'POST' 'AddSolutionComponent' @{
    ComponentId = $flowId
    ComponentType = 29
    SolutionUniqueName = $SolutionUniqueName
    AddRequiredComponents = $true
    DoNotIncludeSubcomponents = $false
    IncludedComponentSettingsValues = $null
  } | Out-Null
}

$live = Request 'GET' "workflows($flowId)?`$select=workflowid,workflowidunique,name,statecode,statuscode,clientdata"
if ([int]$live.statecode -ne [int]$activeState.Value -or [int]$live.statuscode -ne [int]$activeStatus.Value) {
  throw 'Cloud Flow foi criado, mas não ficou ativado.'
}
$parsed = $live.clientdata | ConvertFrom-Json
if ($parsed.properties.definition.triggers.manual.type -ne 'Request') { throw 'Gatilho HTTP não foi persistido.' }
if ($parsed.properties.definition.actions.Validar_contrato.actions.Enviar_email_com_anexo.inputs.host.operationId -ne 'SendEmailV2') {
  throw 'Ação SendEmailV2 não foi persistida.'
}
if ([string]::IsNullOrWhiteSpace($TriggerUrl)) {
  try {
    $TriggerUrl = Resolve-TriggerUrl $url ([string]$live.workflowidunique)
  } catch {
    Step "callback URL não resolvida automaticamente: $($_.Exception.Message)"
  }
}
Ensure-EnvironmentVariable $EnvironmentVariableSchemaName $TriggerUrl
Step "ok. flow=$flowId active=true connectionReference=$officeConnectionReference"
if ([string]::IsNullOrWhiteSpace($TriggerUrl)) {
  Step "ação necessária: copie a URL HTTP do gatilho e rode novamente com -TriggerUrl '<url>'. O app continuará sem URL fixa."
} else {
  Step "environment variable configured: $EnvironmentVariableSchemaName"
}
