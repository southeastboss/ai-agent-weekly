$body = @{
    model = "MiniMax-Text-01"
    messages = @(
        @{role = "user"; content = "Say hello in Chinese"}
    )
    max_tokens = 50
} | ConvertTo-Json -Compress

$headers = @{
    "Authorization" = "Bearer sk-cp-5PmsqTMAiCsMWz265EaeX3bva_NFJ2U-e26wRcgzhwKxAqS_Nv2o9jtTm1OB8CVafm755S7O25LMdfD3-NogbHXDfhZtSPEzO1UftmqJaNvpz6YedgVZV4c"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "https://api.minimax.chat/v1/text/chatcompletion_v2" -Method POST -Headers $headers -Body $body -TimeoutSec 20
$response | ConvertTo-Json -Depth 5
