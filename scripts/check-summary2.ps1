$html = Get-Content "C:\Users\openclose\.openclaw\workspace\ai-agent-weekly\index.html" -Raw
if ($html -match '<p class="card-summary">([^<]+)</p>') {
    Write-Output "Found $($matches.Count) summary elements"
    $1 | Select-Object -First 3 | ForEach-Object { Write-Output $_.Substring(0, [Math]::Min(120, $_.Length)) }
} else {
    Write-Output "No summaries in local index.html"
    Write-Output "File size: $($html.Length)"
}
