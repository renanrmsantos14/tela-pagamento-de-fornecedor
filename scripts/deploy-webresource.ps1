param(
  [Parameter(Mandatory = $true)]
  [string] $EnvironmentUrl,

  [string] $WebResourceName = "cr40f_TelaPagamentoFornecedores.html",

  [string] $DisplayName = "Tela - Pagamento de Fornecedores",

  [string] $SolutionUniqueName = "appbetinhos",

  [string] $FilePath = "dist/index.html",

  [string] $TenantId = "organizations",

  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",

  [switch] $DeviceCode,

  [switch] $NoPublish
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[deploy-webresource] $Message"
}

function Escape-ODataString([string] $Value) {
  return $Value.Replace("'", "''")
}

function Invoke-JsonPost([string] $Uri, [hashtable] $Headers, [object] $Body) {
  $json = $Body | ConvertTo-Json -Depth 8
  return Invoke-RestMethod `
    -Method Post `
    -Uri $Uri `
    -Headers $Headers `
    -ContentType "application/json; charset=utf-8" `
    -Body $json
}

if ($WebResourceName -notmatch '^cr40f_Tela') {
  throw "WebResourceName deve usar o prefixo Dataverse 'cr40f_' e conter Tela: $WebResourceName"
}

function Get-PropertyValue([object] $Object, [string] $Name) {
  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Find-WebResource([string] $ApiBaseUrl, [hashtable] $Headers, [string] $Name) {
  $escapedName = Escape-ODataString $Name
  $lookupUrl = "$ApiBaseUrl/webresourceset?`$select=webresourceid,name,displayname,webresourcetype&`$filter=name eq '$escapedName'"
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $Headers
  $items = @((Get-PropertyValue $lookup "value") | Where-Object { $null -ne $_ })

  if ($items.Count -gt 1) {
    throw "Mais de um WebResource encontrado para name='$Name'. Deploy abortado."
  }

  if ($items.Count -eq 0) {
    return $null
  }

  return $items[0]
}

function Find-Solution([string] $ApiBaseUrl, [hashtable] $Headers, [string] $UniqueName) {
  $escapedName = Escape-ODataString $UniqueName
  $lookupUrl = "$ApiBaseUrl/solutions?`$select=solutionid,uniquename&`$filter=uniquename eq '$escapedName'"
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $Headers
  $items = @((Get-PropertyValue $lookup "value") | Where-Object { $null -ne $_ })

  if ($items.Count -ne 1) {
    throw "Solucao nao encontrada ou ambigua: $UniqueName"
  }

  return $items[0]
}

function Add-ResponseId([object] $Response) {
  $entityUrl = $Response.Headers["OData-EntityId"]
  if ([string]::IsNullOrWhiteSpace($entityUrl)) {
    return $null
  }

  $match = [regex]::Match($entityUrl, '\(([0-9a-fA-F-]{36})\)$')
  if (-not $match.Success) {
    return $null
  }

  return $match.Groups[1].Value
}

function Create-WebResource([string] $ApiBaseUrl, [hashtable] $Headers, [hashtable] $Body, [string] $Name) {
  $createHeaders = @{}
  foreach ($key in $Headers.Keys) {
    $createHeaders[$key] = $Headers[$key]
  }
  $createHeaders["Prefer"] = "return=representation"

  $response = Invoke-WebRequest `
    -Method Post `
    -Uri "$ApiBaseUrl/webresourceset" `
    -Headers $createHeaders `
    -ContentType "application/json; charset=utf-8" `
    -Body ($Body | ConvertTo-Json -Depth 4)

  $created = $null
  if (-not [string]::IsNullOrWhiteSpace($response.Content)) {
    try {
      $created = $response.Content | ConvertFrom-Json
    }
    catch {
      throw "WebResource criado, mas a resposta nao contem JSON valido."
    }
  }

  $webResourceId = Get-PropertyValue $created "webresourceid"
  if (-not [string]::IsNullOrWhiteSpace($webResourceId)) {
    return $webResourceId
  }

  $webResourceId = Add-ResponseId $response
  if (-not [string]::IsNullOrWhiteSpace($webResourceId)) {
    return $webResourceId
  }

  for ($attempt = 1; $attempt -le 5; $attempt++) {
    $created = Find-WebResource $ApiBaseUrl $Headers $Name
    $webResourceId = Get-PropertyValue $created "webresourceid"
    if (-not [string]::IsNullOrWhiteSpace($webResourceId)) {
      return $webResourceId
    }
    Start-Sleep -Seconds 1
  }

  throw "WebResource foi criado, mas o id nao foi retornado nem localizado: $Name"
}

function Test-SolutionComponent([string] $ApiBaseUrl, [hashtable] $Headers, [string] $SolutionId, [string] $WebResourceId) {
  $lookupUrl = "$ApiBaseUrl/solutioncomponents?`$select=solutioncomponentid&`$filter=_solutionid_value eq $SolutionId and objectid eq $WebResourceId and componenttype eq 61"
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $Headers
  return @((Get-PropertyValue $lookup "value") | Where-Object { $null -ne $_ }).Count -gt 0
}

function Ensure-WebResourceInSolution([string] $ApiBaseUrl, [hashtable] $Headers, [string] $SolutionUniqueName, [string] $SolutionId, [string] $WebResourceId) {
  if (Test-SolutionComponent $ApiBaseUrl $Headers $SolutionId $WebResourceId) {
    Write-Step "solution component already exists"
    return
  }

  Write-Step "add webresource to solution $SolutionUniqueName"
  try {
    Invoke-JsonPost "$ApiBaseUrl/AddSolutionComponent" $Headers @{
      ComponentId               = $WebResourceId
      ComponentType             = 61
      SolutionUniqueName        = $SolutionUniqueName
      AddRequiredComponents     = $false
      DoNotIncludeSubcomponents = $true
    } | Out-Null
  }
  catch {
    if (-not (Test-SolutionComponent $ApiBaseUrl $Headers $SolutionId $WebResourceId)) {
      throw
    }
  }

  if (-not (Test-SolutionComponent $ApiBaseUrl $Headers $SolutionId $WebResourceId)) {
    throw "WebResource $WebResourceId nao foi adicionado a solucao $SolutionUniqueName"
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"

Write-Step "build"
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "npm run build falhou com exit code $LASTEXITCODE"
}

$resolvedFilePath = Resolve-Path -LiteralPath $FilePath
$contentBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
  (Get-Content -LiteralPath $resolvedFilePath -Raw -Encoding UTF8)
))

if (-not (Get-Module -ListAvailable MSAL.PS)) {
  throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
}

Import-Module MSAL.PS -ErrorAction Stop

Write-Step "auth"
$scope = "$environmentBaseUrl/user_impersonation"
$redirectUri = [Uri] "http://localhost"
$clientApplication = New-MsalClientApplication `
  -ClientId $ClientId `
  -TenantId $TenantId `
  -RedirectUri $redirectUri

Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication

try {
  $tokenResult = Get-MsalToken `
    -PublicClientApplication $clientApplication `
    -Scopes $scope `
    -Silent
}
catch {
  if ($DeviceCode) {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -DeviceCode
  }
  else {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -Interactive
  }
}

$token = $tokenResult.AccessToken
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Falha ao obter token MSAL para $scope"
}

$headers = @{
  "Authorization"              = "Bearer $token"
  "Accept"                     = "application/json"
  "OData-MaxVersion"           = "4.0"
  "OData-Version"              = "4.0"
  "MSCRM.SolutionUniqueName"   = $SolutionUniqueName
}

$solution = Find-Solution $apiBaseUrl $headers $SolutionUniqueName
$solutionId = Get-PropertyValue $solution "solutionid"
if ([string]::IsNullOrWhiteSpace($solutionId)) {
  throw "A solucao $SolutionUniqueName nao retornou solutionid"
}

Write-Step "lookup $WebResourceName"
$webResource = Find-WebResource $apiBaseUrl $headers $WebResourceName

$webResourceId = $null
if ($null -eq $webResource) {
  $createBody = @{
    name            = $WebResourceName
    displayname     = $DisplayName
    webresourcetype = 1
    content         = $contentBase64
  }

  Write-Step "create $WebResourceName in solution $SolutionUniqueName"
  $webResourceId = Create-WebResource $apiBaseUrl $headers $createBody $WebResourceName
}
else {
  $webResourceId = Get-PropertyValue $webResource "webresourceid"
}

if ([string]::IsNullOrWhiteSpace($webResourceId)) {
  throw "Nao foi possivel obter o id do WebResource $WebResourceName"
}

$patchBody = @{ content = $contentBase64 }
Write-Step "patch $webResourceId"
Invoke-RestMethod `
  -Method Patch `
  -Uri "$apiBaseUrl/webresourceset($webResourceId)" `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body ($patchBody | ConvertTo-Json -Depth 4) | Out-Null

Ensure-WebResourceInSolution $apiBaseUrl $headers $SolutionUniqueName $solutionId $webResourceId

if (-not $NoPublish) {
  $publishXml = "<importexportxml><webresources><webresource>$webResourceId</webresource></webresources></importexportxml>"
  Write-Step "publish $webResourceId"
  Invoke-JsonPost "$apiBaseUrl/PublishXml" $headers @{ ParameterXml = $publishXml } | Out-Null
}

Write-Step "ok $WebResourceName | solution=$SolutionUniqueName"
