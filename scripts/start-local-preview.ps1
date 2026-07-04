$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$log = Join-Path $root 'local-preview.log'
$err = Join-Path $root 'local-preview.err.log'

Set-Location -LiteralPath $root
& 'C:\Program Files\nodejs\node.exe' '.\node_modules\@angular\cli\bin\ng' serve --host 127.0.0.1 --port 4200 --configuration development *> $log
