!macro customCheckAppRunning
  DetailPrint "Closing ${PRODUCT_NAME} processes before installation."

  StrCpy $R9 0
  close_processes:
    nsExec::ExecToLog `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and $$_.Path.StartsWith('$INSTDIR', [System.StringComparison]::CurrentCultureIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
    nsExec::ExecToLog `"$CmdPath" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    nsExec::ExecToLog `"$CmdPath" /C taskkill /F /T /IM "BeatGrid.exe"`
    Sleep 1200
    IntOp $R9 $R9 + 1
    IntCmp $R9 2 processes_closed close_processes close_processes

  processes_closed:
!macroend
