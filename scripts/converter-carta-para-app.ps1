<#
.SYNOPSIS
  Converte suas cartas náuticas (arquivos .zip com .KAP baixados do site oficial
  da Marinha do Brasil) em um pacote de tiles pronto para importar no app CartaLivre.

.DESCRIPTION
  Este script roda no SEU computador, sobre cartas que VOCÊ baixou. O CartaLivre
  não baixa, processa nem redistribui cartas da DHN — só te ajuda a converter,
  no seu próprio equipamento, o que você já baixou por conta própria.

  Para cada .zip na pasta de entrada:
    1. Extrai o .KAP
    2. Converte para GeoTIFF EPSG:3857 via Docker (GDAL)
    3. Gera tiles PNG (zoom configurável) via gdal2tiles.py
    4. Extrai a área coberta pela carta (bbox) via gdalinfo
    5. Gera charts-manifest.json
    6. Empacota tudo em pacote-cartas.zip, pronto para importar no app

.REQUISITOS
  Docker Desktop instalado e em execução: https://www.docker.com/products/docker-desktop/

.EXAMPLE
  .\converter-carta-para-app.ps1
  .\converter-carta-para-app.ps1 -InputDir "C:\minhas-cartas" -OutputDir "C:\saida"
#>

param(
  [string]$InputDir  = ".\entrada",
  [string]$OutputDir = ".\saida",
  [int]$ZoomMin = 10,
  [int]$ZoomMax = 16,
  [int]$Workers = 4,
  [string]$ResolveChartIdOnly = ''
)

$ErrorActionPreference = "Stop"

function Resolve-ChartId([string]$name) {
  if ($name -match '[\/]') { throw "Nome de carta inválido: $name" }
  $baseName = [IO.Path]::GetFileNameWithoutExtension($name).Trim().ToUpperInvariant()
  if ($baseName -match 'TRANSACOES|GEOTIFF' -or $baseName -notmatch '^[A-Z0-9]+(?:-[A-Z0-9]+)*$') {
    throw "Nome de carta inválido: $name"
  }
  return $baseName
}

if ($ResolveChartIdOnly) {
  Resolve-ChartId $ResolveChartIdOnly
  return
}

$GDAL_IMAGE = "ghcr.io/rjsmarquesti/cartalivre-gdal:latest"
$DOCKERFILE = Join-Path $PSScriptRoot "Dockerfile.gdal"

# ── Checagem de pré-requisitos ──────────────────────────────────────────────

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "ERRO: Docker não encontrado." -ForegroundColor Red
  Write-Host "Instale o Docker Desktop antes de continuar: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  exit 1
}

try {
  docker info *> $null
} catch {
  Write-Host "ERRO: Docker está instalado, mas não parece estar rodando." -ForegroundColor Red
  Write-Host "Abra o Docker Desktop, aguarde ele iniciar, e tente novamente." -ForegroundColor Yellow
  exit 1
}

$imagemDisponivel = $true
docker image inspect $GDAL_IMAGE *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Baixando a imagem de conversão (só na primeira vez)..." -ForegroundColor Cyan
  docker pull $GDAL_IMAGE *> $null
  if ($LASTEXITCODE -ne 0) {
    $imagemDisponivel = $false
  }
}

if (!$imagemDisponivel) {
  if (!(Test-Path $DOCKERFILE)) {
    Write-Host "ERRO: não foi possível baixar a imagem de conversão, e o Dockerfile.gdal não foi encontrado pra buildar localmente." -ForegroundColor Red
    exit 1
  }
  Write-Host "Não foi possível baixar a imagem pronta — buildando localmente (só na primeira vez, pode levar alguns minutos)..." -ForegroundColor Cyan
  docker build -t $GDAL_IMAGE -f $DOCKERFILE (Split-Path $DOCKERFILE)
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: falha ao buildar a imagem de conversão localmente." -ForegroundColor Red
    exit 1
  }
}

# ── Preparação ────────────────────────────────────────────────────────────────

if (!(Test-Path $InputDir)) {
  Write-Host "ERRO: pasta de entrada não encontrada: $InputDir" -ForegroundColor Red
  Write-Host "Crie essa pasta e coloque nela os arquivos .zip das suas cartas (baixados do site da Marinha)." -ForegroundColor Yellow
  exit 1
}

$tempDir   = Join-Path $OutputDir "_temp"
$chartsDir = Join-Path $OutputDir "charts"  # cada carta em subpasta
$manifest  = @()

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $chartsDir | Out-Null

# Candidatos KAP; transações e GeoTIFF seguem pipelines separados.
$zips = Get-ChildItem $InputDir -Filter "*.zip" | Where-Object {
  $_.Name -notmatch "Transacoes|geotiff|Geotiff"
}

if ($zips.Count -eq 0) {
  Write-Host "ERRO: nenhum .zip válido encontrado em $InputDir" -ForegroundColor Red
  Write-Host "Baixe suas cartas (formato BSB/.KAP) no site oficial da Marinha do Brasil e coloque os .zip aqui." -ForegroundColor Yellow
  exit 1
}

$seenChartIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

Write-Host "=== Convertendo suas cartas ===" -ForegroundColor Cyan
Write-Host "Entrada: $InputDir ($($zips.Count) arquivo(s) encontrado(s))"
Write-Host "Saída:   $OutputDir"
Write-Host "Isso pode levar alguns minutos por carta." -ForegroundColor Yellow
Write-Host ""

$processed = 0
$erros = 0

foreach ($zip in $zips) {
  $processed++
  $chartId = ''
  $chartBase = ($zip.BaseName -replace '[^A-Za-z0-9_-]', '_') + "_$processed"

  Write-Host "[$processed/$($zips.Count)] $($zip.Name)" -NoNewline

  $zipTemp = Join-Path $tempDir $chartBase
  New-Item -ItemType Directory -Force -Path $zipTemp | Out-Null

  try {
    # 1. Extrair zip
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $zipTemp -Force

    # 2. Encontrar arquivo .kap
    $kapFile = Get-ChildItem $zipTemp -Filter "*.kap" -Recurse | Select-Object -First 1
    if (!$kapFile) {
      Write-Host " [PULADO: não achei um arquivo .KAP dentro deste zip]" -ForegroundColor Yellow
      continue
    }

    $chartId = Resolve-ChartId $kapFile.BaseName
    if (!$seenChartIds.Add($chartId)) {
      Write-Host " [PULADO: carta $chartId já processada nesta execução]" -ForegroundColor Yellow
      continue
    }

    # 3. Copiar para pasta de trabalho montável no Docker
    $dockerInput = Join-Path $tempDir "docker-input"
    New-Item -ItemType Directory -Force -Path $dockerInput | Out-Null
    Copy-Item $kapFile.FullName "$dockerInput\$chartId.kap" -Force

    # 4. Expandir paleta para RGB, reprojetar e gerar tiles XYZ por carta.
    $chartTileDir = Join-Path $chartsDir $chartId
    New-Item -ItemType Directory -Force -Path $chartTileDir | Out-Null
    $mountInput = $dockerInput
    $mountOutput = $chartsDir

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $result = docker run --rm `
      -v "${mountInput}:/input:ro" `
      -v "${mountOutput}:/output" `
      $GDAL_IMAGE `
      bash -lc "set -euo pipefail; gdal_translate -expand rgb /input/$chartId.kap /tmp/$chartId-rgb.tif; gdalwarp -t_srs EPSG:3857 -r bilinear /tmp/$chartId-rgb.tif /tmp/$chartId-3857.tif; gdal2tiles.py --zoom $ZoomMin-$ZoomMax --processes $Workers --xyz --tilesize 256 --resampling bilinear /tmp/$chartId-3857.tif /output/$chartId"
    $gdalExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($gdalExitCode -ne 0) { throw "Falha ao converter a carta $chartId (código $gdalExitCode): $($result -join ' ')" }

    $ErrorActionPreference = "Continue"
    $infoResult = docker run --rm `
      -v "${mountInput}:/input:ro" `
      $GDAL_IMAGE `
      gdalinfo -json "/input/$chartId.kap"
    $infoExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($infoExitCode -ne 0) { throw "Falha ao ler informações da carta $chartId (código $infoExitCode): $($infoResult -join ' ')" }

    # 5. Extrair bbox do output do gdalinfo -json
    $bbox = $null
    $jsonStr = ($infoResult | Out-String)
    try {
      $jsonObj = $jsonStr | ConvertFrom-Json -AsHashtable
      # Usar wgs84Extent (graus decimais) em vez de cornerCoordinates (Mercator)
      $extent = $jsonObj['wgs84Extent']
      if ($extent -and $extent['coordinates']) {
        $coords = $extent['coordinates'][0]  # polygon ring
        $lons = $coords | ForEach-Object { $_[0] }
        $lats = $coords | ForEach-Object { $_[1] }
        $bbox = @(
          ($lons | Measure-Object -Minimum).Minimum,
          ($lats | Measure-Object -Minimum).Minimum,
          ($lons | Measure-Object -Maximum).Maximum,
          ($lats | Measure-Object -Maximum).Maximum
        )
      }
    } catch {
      # Fallback: extrair coordenadas DMS do gdalinfo texto
      $ulLine = ($infoResult | Select-String "Upper Left").Line
      $lrLine = ($infoResult | Select-String "Lower Right").Line
      if ($ulLine -and $lrLine) {
        # Formato: ( 43d14' 0.00"W, 22d51'59.99"S)
        $dmsRegex = '\(\s*(\d+)d(\d+)''\s*([\d.]+)"([NSEW]),\s*(\d+)d(\d+)''\s*([\d.]+)"([NSEW])\s*\)'
        $ulDms = [regex]::Match($ulLine, $dmsRegex)
        $lrDms = [regex]::Match($lrLine, $dmsRegex)
        if ($ulDms.Success -and $lrDms.Success) {
          function Parse-Dms($d, $m, $s, $dir) {
            $dec = [double]$d + [double]$m/60 + [double]$s/3600
            if ($dir -eq 'S' -or $dir -eq 'W') { $dec = -$dec }
            return $dec
          }
          $ulLon = Parse-Dms $ulDms.Groups[1].Value $ulDms.Groups[2].Value $ulDms.Groups[3].Value $ulDms.Groups[4].Value
          $ulLat = Parse-Dms $ulDms.Groups[5].Value $ulDms.Groups[6].Value $ulDms.Groups[7].Value $ulDms.Groups[8].Value
          $lrLon = Parse-Dms $lrDms.Groups[1].Value $lrDms.Groups[2].Value $lrDms.Groups[3].Value $lrDms.Groups[4].Value
          $lrLat = Parse-Dms $lrDms.Groups[5].Value $lrDms.Groups[6].Value $lrDms.Groups[7].Value $lrDms.Groups[8].Value
          $bbox = @(
            [math]::Min($ulLon, $lrLon),
            [math]::Min($ulLat, $lrLat),
            [math]::Max($ulLon, $lrLon),
            [math]::Max($ulLat, $lrLat)
          )
        }
      }
    }

    if (!$bbox -or ($bbox[0] -eq 0 -and $bbox[2] -eq 0)) {
      Write-Host " [AVISO: não consegui determinar a área da carta]" -ForegroundColor Yellow
      $bbox = @(0, 0, 0, 0)
    }

    # 6. Determinar nome da carta
    $chartName = "Carta $chartId"

    # 7. Contar e medir tiles antes de adicionar ao manifesto
    $tileFiles = Get-ChildItem $chartTileDir -Filter "*.png" -Recurse -ErrorAction SilentlyContinue
    $tileCount = $tileFiles.Count
    $sizeBytes = ($tileFiles | Measure-Object Length -Sum).Sum
    if ($tileCount -eq 0) { throw "Nenhum tile foi gerado para a carta $chartId" }

    $manifest += @{
      id        = $chartId
      name      = $chartName
      bbox      = $bbox
      minZoom   = $ZoomMin
      maxZoom   = $ZoomMax
      tileCount = $tileCount
      sizeBytes = $sizeBytes
    }
    Write-Host " OK ($tileCount tiles)" -ForegroundColor Green

  } catch {
    Write-Host " ERRO: $_" -ForegroundColor Red
    $erros++
  } finally {
    # Limpar temp
    if (Test-Path $zipTemp) { Remove-Item $zipTemp -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $dockerInput) { Remove-Item $dockerInput -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# ── Gerar manifesto ───────────────────────────────────────────────────────────

$manifestObj = @{
  version     = 1
  generatedAt = (Get-Date).ToString("o")
  chartCount  = $manifest.Count
  charts      = $manifest | Sort-Object { [int]$_.id }
}

$manifestPath = Join-Path $OutputDir "charts-manifest.json"
$manifestObj | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

# ── Empacotar para importação no app ────────────────────────────────────────

$pacoteZip = Join-Path $OutputDir "pacote-cartas.zip"
if (Test-Path $pacoteZip) { Remove-Item $pacoteZip -Force }
if ($manifest.Count -gt 0) {
  Compress-Archive -Path $chartsDir, $manifestPath -DestinationPath $pacoteZip
}

# ── Limpar pasta temporária ───────────────────────────────────────────────────

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# ── Resumo ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Concluído ===" -ForegroundColor Cyan
Write-Host "Cartas convertidas: $($manifest.Count)"
Write-Host "Erros:              $erros"
if ($manifest.Count -gt 0) {
  Write-Host "Pacote pronto para importar no app: $pacoteZip" -ForegroundColor Green
  Write-Host "Copie esse arquivo para o seu celular e importe pela aba 'Cartas' do app."
} else {
  Write-Host "Nenhuma carta foi convertida com sucesso — nenhum pacote foi gerado." -ForegroundColor Yellow
}
