# Ayudante nativo de CursorClip: guarda el .md oculto en Temp (hasta 50, los más antiguos fuera)
# y lo deja en el portapapeles como fichero
# Protocolo de Chrome: 4 bytes de longitud + JSON en UTF-8, por stdin y stdout
$ErrorActionPreference = 'Stop'
$MaxFiles = 50

$stdin = [Console]::OpenStandardInput()
$stdout = [Console]::OpenStandardOutput()

function Read-Exact([int]$size) {
  $buf = New-Object byte[] $size
  $n = 0
  while ($n -lt $size) {
    $r = $stdin.Read($buf, $n, $size - $n)
    if ($r -le 0) { return $null }
    $n += $r
  }
  return ,$buf
}

function Send-Message($obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $stdout.Write([BitConverter]::GetBytes([int]$bytes.Length), 0, 4)
  $stdout.Write($bytes, 0, $bytes.Length)
  $stdout.Flush()
}

$len = Read-Exact 4
if ($null -eq $len) { exit }
$body = Read-Exact ([BitConverter]::ToInt32($len, 0))
if ($null -eq $body) { exit }
$msg = [Text.Encoding]::UTF8.GetString($body) | ConvertFrom-Json

try {
  if ($msg.type -eq 'ping') { Send-Message @{ ok = $true; version = 1 }; exit }
  if ($msg.type -ne 'save') { throw "mensaje desconocido: $($msg.type)" }

  $dir = Join-Path $env:TEMP 'copiar-elemento'
  New-Item -ItemType Directory -Force $dir | Out-Null
  $name = [string]$msg.name -replace '[\\/:*?"<>|]', '_'
  if (-not $name.EndsWith('.md')) { $name += '.md' }
  $base = $name.Substring(0, $name.Length - 3)

  # Si el nombre ya está cogido: nombre_2.md, nombre_3.md…
  $path = Join-Path $dir $name
  for ($n = 2; [IO.File]::Exists($path); $n++) { $path = Join-Path $dir "${base}_$n.md" }

  [IO.File]::WriteAllText($path, [string]$msg.text, (New-Object Text.UTF8Encoding $false))
  [IO.File]::SetAttributes($path, [IO.FileAttributes]::Hidden)

  # Se guardan los últimos $MaxFiles; los más antiguos fuera (con -Force para ver los ocultos)
  Get-ChildItem -LiteralPath $dir -Force -File -Filter *.md |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -Skip $MaxFiles |
    Remove-Item -Force

  Add-Type -AssemblyName System.Windows.Forms
  $files = New-Object Collections.Specialized.StringCollection
  [void]$files.Add($path)
  # El portapapeles puede estar ocupado por otra app un instante
  for ($i = 0; ; $i++) {
    try { [Windows.Forms.Clipboard]::SetFileDropList($files); break }
    catch { if ($i -ge 4) { throw }; Start-Sleep -Milliseconds 100 }
  }

  Send-Message @{ ok = $true; path = $path }
} catch {
  Send-Message @{ ok = $false; error = $_.Exception.Message }
}
