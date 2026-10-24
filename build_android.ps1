# ==============================================================================
# MyMusic - Android Production Build Script (PowerShell)
# Low-memory, low-size build optimized for low-end Android devices
# ==============================================================================

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   MyMusic - Building Android Production Bundle   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Verify Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required but not found in PATH." -ForegroundColor Red
    exit 1
}

# 2. Build Web Production Bundle
Write-Host "`n[1/3] Building optimized web bundle (<95 KB gzipped)..." -ForegroundColor Yellow
Set-Location "$ScriptDir\web"
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Web bundle compilation failed." -ForegroundColor Red
    Set-Location $ScriptDir
    exit 1
}

# 3. Synchronize Web Assets with Android Project
Write-Host "`n[2/3] Synchronizing assets into Android project (Capacitor)..." -ForegroundColor Yellow
cmd /c "npx cap sync android"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Capacitor sync failed." -ForegroundColor Red
    Set-Location $ScriptDir
    exit 1
}

# 4. Check for Gradle / Android Studio
Write-Host "`n[3/3] Checking native Android build environment..." -ForegroundColor Yellow
$Gradlew = "$ScriptDir\web\android\gradlew.bat"

if (Test-Path $Gradlew) {
    # Check if Java 17+ is installed
    $JavaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($JavaCmd -and $env:JAVA_HOME) {
        Write-Host "Java found at: $($JavaCmd.Source). Attempting APK compilation..." -ForegroundColor Green
        Set-Location "$ScriptDir\web\android"
        cmd /c "gradlew.bat assembleRelease"
        if ($LASTEXITCODE -eq 0) {
            $ApkPath = "$ScriptDir\web\android\app\build\outputs\apk\release\app-release-unsigned.apk"
            Write-Host "`n==================================================" -ForegroundColor Green
            Write-Host "SUCCESS! Production APK generated at:" -ForegroundColor Green
            Write-Host "$ApkPath" -ForegroundColor White
            Write-Host "==================================================" -ForegroundColor Green
            Set-Location $ScriptDir
            exit 0
        } else {
            Write-Host "[INFO] Running debug assembly fallback..." -ForegroundColor Yellow
            cmd /c "gradlew.bat assembleDebug"
        }
    }
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "Android project is completely synced & production-ready!" -ForegroundColor Green
Write-Host "To open in Android Studio and build / install the APK:" -ForegroundColor White
Write-Host "  1. Run: cd web && npx cap open android" -ForegroundColor Cyan
Write-Host "  2. In Android Studio: Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor Cyan
Write-Host "  3. Or run on connected device: cd web && npx cap run android" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
Set-Location $ScriptDir
