# Stop-хук: не дає Claude завершити роботу, якщо після змін у коді падають перевірки.
# exit 2 = повернути Claude до роботи (stderr іде йому як пояснення); exit 0 = відпустити.

$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json

# Уже продовжували один раз через цей хук — відпускаємо, щоб не зациклитись.
if ($payload.stop_hook_active) { exit 0 }

# Проєкт ще не створено (етап каркаса) — перевіряти нічого.
if (-not (Test-Path "package.json")) { exit 0 }

# Немає незакомічених змін у коді — це була розмова чи планування, тести не запускаємо.
$changes = git status --porcelain -- apps packages 2>$null
if (-not $changes) { exit 0 }

foreach ($step in @("typecheck", "lint", "test")) {
    $out = pnpm $step 2>&1
    if ($LASTEXITCODE -ne 0) {
        $tail = ($out | Select-Object -Last 40) -join "`n"
        [Console]::Error.WriteLine("pnpm $step fails. Fix it before finishing the task:`n$tail")
        exit 2
    }
}
exit 0
