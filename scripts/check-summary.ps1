$html = Get-Content "$env:TEMP\ai-agent-summary.html" -Raw
if ($html -match '<p class="card-summary">([^<]+)</p>') {
    Write-Output "Found summaries: $($matches.Count)"
    $matches[1..[Math]::Min(3,$matches.Count)] | ForEach-Object { Write-Output $_.Substring(0, [Math]::Min(100, $_.Length)) }
} else {
    Write-Output "No summaries found"
    Write-Output "File size: $($html.Length)"
    # Check if the CSS is there
    if ($html -match '\.card-summary') {
        Write-Output "CSS for card-summary IS present"
    }
}
