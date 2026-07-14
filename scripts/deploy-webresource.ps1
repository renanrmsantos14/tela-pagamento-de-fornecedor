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

$escapedName = Escape-ODataString $WebResourceName
$lookupUrl = "$apiBaseUrl/webresourceset?`$select=webresourceid,name,displayname,webresourcetype&`$filter=name eq '$escapedName'"
Write-Step "lookup $WebResourceName"
$lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $headers
$lookupItems = @($lookup.value | Where-Object { $null -ne $_ })

if ($lookupItems.Count -gt 1) {
  throw "Mais de um WebResource encontrado para name='$WebResourceName'. Deploy abortado."
}

$webResourceId = $null
$wasCreated = $false
if ($lookupItems.Count -eq 0) {
  $createBody = @{
    name            = $WebResourceName
    displayname     = $DisplayName
    webresourcetype = 1
    content         = $contentBase64
  }

  Write-Step "create $WebResourceName in solution $SolutionUniqueName"
  $created = Invoke-JsonPost "$apiBaseUrl/webresourceset" $headers $createBody
  $wasCreated = $true
  $webResourceId = $created.webresourceid
  if ([string]::IsNullOrWhiteSpace($webResourceId)) {
    $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $headers
    $webResourceId = @($lookup.value)[0].webresourceid
  }
}
else {
  $webResourceId = $lookupItems[0].webresourceid
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

if ($wasCreated) {
  Write-Step "add $WebResourceName to solution $SolutionUniqueName"
  Invoke-JsonPost "$apiBaseUrl/AddSolutionComponent" $headers @{
    ComponentId               = $webResourceId
    ComponentType             = 61
    SolutionUniqueName        = $SolutionUniqueName
    AddRequiredComponents     = $false
    DoNotIncludeSubcomponents = $true
  } | Out-Null
}

if (-not $NoPublish) {
  $publishXml = "<importexportxml><webresources><webresource>$webResourceId</webresource></webresources></importexportxml>"
  Write-Step "publish $webResourceId"
  Invoke-JsonPost "$apiBaseUrl/PublishXml" $headers @{ ParameterXml = $publishXml } | Out-Null
}

Write-Step "ok $WebResourceName | solution=$SolutionUniqueName"
