# Dragino SN50V3-LS - Automatic Build & Flash Script for ADS1115 Firmware
$ErrorActionPreference = "Stop"

# Configurations
$port = "COM3"
$baud = 115200
$address = "0x0800D000"
$sdkPath = "D:\projekte\Dragino-SN50V3-LS"
$toolchainUrl = "https://developer.arm.com/-/media/Files/downloads/gnu-rm/9-2020q2/gcc-arm-none-eabi-9-2020-q2-update-win32.zip"
$toolchainZip = "D:\projekte\Dragino-SN50V3-LB\tools\gcc-arm-none-eabi.zip"
$toolchainDir = "D:\projekte\Dragino-SN50V3-LB\tools\toolchain"

# Create tools directory if it doesn't exist
if (!(Test-Path "$sdkPath\tools")) {
    New-Item -ItemType Directory -Path "$sdkPath\tools" -Force
}

# 1. Ensure Toolchain is installed
if (!(Test-Path "$toolchainDir\bin\arm-none-eabi-gcc.exe")) {
    Write-Host "=== [1/4] Downloading GCC ARM Toolchain ===" -ForegroundColor Cyan
    Write-Host "Downloading via curl (~80MB)..." -ForegroundColor Yellow
    
    # Run curl to download the file directly and quickly
    & curl.exe -L -f -o "$toolchainZip" "$toolchainUrl"
    
    Write-Host "Extracting Toolchain..." -ForegroundColor Cyan
    Expand-Archive -Path $toolchainZip -DestinationPath $toolchainDir -Force
    Remove-Item $toolchainZip -Force
    Write-Host "Toolchain successfully installed!" -ForegroundColor Green
} else {
    Write-Host "=== [1/4] GCC ARM Toolchain already installed ===" -ForegroundColor Green
}

# 2. Build the firmware using Git Bash & mingw32-make
Write-Host "=== [2/4] Building Firmware ===" -ForegroundColor Cyan
Write-Host "Compiling firmware inside Git Bash environment..." -ForegroundColor Cyan

# We use Git Bash because the Makefile requires unix utilities like uname and realpath
$gitBash = "C:\Program Files\Git\bin\bash.exe"
$bashCommand = "export PATH=`"/d/projekte/Dragino-SN50V3-LB/tools/toolchain/bin:`$PATH`" ; export TREMO_SDK_PATH=`"/d/projekte/Dragino-SN50V3-LS`" ; cd /d/projekte/Dragino-SN50V3-LS/Projects/Applications/DRAGINO-LRWAN-AT ; mingw32-make.exe clean ; mingw32-make.exe"

& $gitBash -c $bashCommand

# Find compiled binary in Make_out
$binPath = "$sdkPath\Projects\Applications\DRAGINO-LRWAN-AT\Make_out\DRAGINO-LRWAN-AT.bin"
if (!(Test-Path $binPath)) {
    Write-Error "Compilation failed. No binary file found at $binPath!"
}
Write-Host "Firmware compiled successfully: $binPath" -ForegroundColor Green

# 3. Double Check Safe Address & Preserve EUI/Keys
Write-Host "=== [3/4] Security Verification ===" -ForegroundColor Cyan
$binSize = (Get-Item $binPath).Length
$flashEnd = [Convert]::ToInt32($address, 16) + $binSize
$keyStart = 0x0803E000

Write-Host "Flash Start: $address" -ForegroundColor Gray
Write-Host "Binary Size: $binSize bytes" -ForegroundColor Gray
Write-Host "Flash End  : 0x$([Convert]::ToString($flashEnd, 16).ToUpper())" -ForegroundColor Gray
Write-Host "Keys Sector: 0x$([Convert]::ToString($keyStart, 16).ToUpper())" -ForegroundColor Gray

if ($flashEnd -ge $keyStart) {
    Write-Error "Security Check Failed! Firmware binary size overlaps with the Keys and Config sector at 0x0803E000!"
} else {
    Write-Host "Security Check Passed! Flashing is completely SAFE. Existing EUI, AppKey, and PINs are protected." -ForegroundColor Green
}

# 4. Flashing
Write-Host "=== [4/4] Flashing Firmware via $port (Baudrate: $baud) ===" -ForegroundColor Cyan
Write-Host "Starting upload to ASR6601..." -ForegroundColor Yellow

python build/scripts/tremo_loader.py --port $port --baud $baud flash $address $binPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Flashing failed with exit code $LASTEXITCODE! Bitte stellen Sie sicher, dass:
1. Der Schalter auf dem Board auf 'ISP' geschoben wurde.
2. Die RESET-Taste gedrueckt oder kurz stromlos gemacht wurde.
3. ALLE anderen Programme, die COM3 nutzen (z.B. serielle Monitore, Putty, Arduino-IDE, Dragino Utility), geschlossen sind!"
} else {
    Write-Host "=== SUCCESS: Flashing Completed! ===" -ForegroundColor Green
}
