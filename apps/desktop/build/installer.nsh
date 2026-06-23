!macro customCheckAppRunning
  DetailPrint "Checking for running ${PRODUCT_NAME} processes in $INSTDIR."

  nsExec::ExecToLog `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance -ClassName Win32_Process | Where-Object { $$_.Path -and $$_.Path.Equals('$INSTDIR\${APP_EXECUTABLE_FILENAME}', [System.StringComparison]::CurrentCultureIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  nsExec::ExecToLog `"$CmdPath" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`

  Sleep 1000
!macroend
