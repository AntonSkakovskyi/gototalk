# Stop hook: blocks finishing while checks fail after code changes (exit 2 sends stderr back to Claude, exit 0 lets it stop).

$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json

# Already continued once through this hook: let it stop to avoid a loop.
if ($payload.stop_hook_active) { exit 0 }

if (-not (Test-Path "package.json")) { exit 0 }

# No uncommitted code changes (discussion or planning): skip the checks.
$changes = git status --porcelain -- apps packages 2>$null
if (-not $changes) { exit 0 }

# A running Vitest process (e.g. one VS Code keeps alive) skips all checks (typecheck, lint, test), so run `pnpm test` manually before a PR.
$vitest = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'vitest' }
if ($vitest) { exit 0 }

foreach ($step in @("typecheck", "lint", "test")) {
    $out = pnpm $step 2>&1
    if ($LASTEXITCODE -ne 0) {
        $tail = ($out | Select-Object -Last 40) -join "`n"
        [Console]::Error.WriteLine("pnpm $step fails. Fix it before finishing the task:`n$tail")
        exit 2
    }
}
exit 0
