#Requires -Version 5.1
$root = "C:\Users\PC\Downloads\TESSERACT-NEXT\TESSERACT NEW\src\content\talky"
$files = @("auto-answer.js", "auto-answer-panel.js", "smart-mailing.js", "smart-mailing-panel.js", "like-follow-photos.js", "talky-bot-panel.js", "reminder.js", "dom-contact-finder.js")

$replacements = @()
$replacements += , @('document.querySelectorAll("a[href]")', 'document.querySelectorAll(TALK_Y.ALL_LINKS)')
$replacements += , @("document.querySelectorAll('a[href]')", 'document.querySelectorAll(TALK_Y.ALL_LINKS)')
$replacements += , @("querySelector(\"[class*=\\\"pin\\\"], [class*=\\\"saved\\\"], [class*=\\\"star\\\"], [class*=\\\"fixed\\\"]\")", 'querySelector(TALK_Y.PINNED_INDICATORS_LIGHT)')
$replacements += , @('querySelector("[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"]")', 'querySelector(TALK_Y.PINNED_INDICATORS_LIGHT)')
$replacements += , @('if (contactEl.querySelector("[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"]")) return true;', 'if (contactEl.querySelector(TALK_Y.PINNED_INDICATORS_LIGHT)) return true;')
$replacements += , @('querySelector("[class*="send"]:not(button), [class*="submit"]:not(button)")', 'querySelector(TALK_Y.SEND_BTN_ALT_FALLBACK)')
$replacements += , @('document.querySelectorAll("[class*="message"], [class*="conversation"], [class*="inbox"], [class*="mailbox"]")', 'document.querySelectorAll(TALK_Y.MESSAGE_AREAS)')
$replacements += , @('querySelector("[class*="notification"], [class*="alert"], [class*="toast"], [class*="message-list"], [class*="inbox"]")', 'querySelector(TALK_Y.NOTIFICATION_CONTAINER)')
$replacements += , @('querySelector("[class*="profile-detail"], [class*="user-profile"], [class*="member-info"], [class*="contact-info"]")', 'querySelector(TALK_Y.PROFILE_DETAIL)')
$replacements += , @('querySelector("[class*="bio"], [class*="description"], [class*="about"]")', 'querySelector(TALK_Y.PROFILE_BIO)')
$replacements += , @('querySelector("[class*="name"], [class*="title"]")', 'querySelector(TALK_Y.PROFILE_NAME)')
$replacements += , @('querySelector("[class*="location"], [class*="city"]")', 'querySelector(TALK_Y.PROFILE_LOCATION)')
$replacements += , @('querySelector("[class*="time"], [class*="date"], [class*="updated"], small, time")', 'querySelector(TALK_Y.TIME_ELEMENT)')
$replacements += , @('querySelector("[class*="time"], [class*="duration"], [class*="date"], [class*="timestamp"]")', 'querySelector(TALK_Y.TIME_ELEMENT)')
$replacements += , @('document.querySelectorAll("[class*="active"], [id*="active"]")', 'document.querySelectorAll(TALK_Y.ACTIVE_SECTION)')
$replacements += , @('document.querySelectorAll("button, [role=\"button\"]")', 'document.querySelectorAll(TALK_Y.ALL_BUTTONS)')
$replacements += , @("document.querySelectorAll('button, [role=\"button\"]')", 'document.querySelectorAll(TALK_Y.ALL_BUTTONS)')

Write-Output "Starting replacements..."
$totalModified = 0
foreach ($file in $files) {
    $path = Join-Path $root $file
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $modified = $false
        foreach ($r in $replacements) {
            if ($content.Contains($r[0])) {
                $content = $content -replace [regex]::Escape($r[0]), $r[1]
                $modified = $true
            }
        }
        if ($modified) {
            Set-Content -Path $path -Value $content -NoNewline
            Write-Output "Modified: $file"
            $totalModified++
        }
    }
}
Write-Output "Done. Total files modified: $totalModified"
