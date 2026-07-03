!ifndef BUILD_UNINSTALLER
  Var /GLOBAL previousInstallDir
!endif

!macro closeInstalledProcesses INSTALL_PATH
  StrCpy $R9 0
  close_processes:
    nsExec::ExecToLog `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | Where-Object { $$_.Path -and $$_.Path.StartsWith('${INSTALL_PATH}', [System.StringComparison]::CurrentCultureIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
    nsExec::ExecToLog `"$CmdPath" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    nsExec::ExecToLog `"$CmdPath" /C taskkill /F /T /IM "BeatGrid.exe"`
    Sleep 1200
    IntOp $R9 $R9 + 1
    IntCmp $R9 2 processes_closed close_processes close_processes
  processes_closed:
!macroend

!macro customCheckAppRunning
  DetailPrint "Preparing a clean ${PRODUCT_NAME} installation."

  !ifdef BUILD_UNINSTALLER
    !insertmacro closeInstalledProcesses "$INSTDIR"
  !else
    ReadRegStr $previousInstallDir SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $previousInstallDir == ""
    ${andIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      StrCpy $previousInstallDir "$INSTDIR"
    ${endIf}

    ${if} $previousInstallDir != ""
      !insertmacro closeInstalledProcesses "$previousInstallDir"
    ${endIf}

    # Do not invoke the previous uninstaller. Older releases can incorrectly
    # report a running process and block the entire upgrade.
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
      DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    !endif

    ${if} $installMode == "all"
      StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_FILENAME}-${VERSION}"
    ${else}
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}-${VERSION}"
    ${endIf}
    StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    SetOutPath "$INSTDIR"
  !endif
!macroend

!macro customInstall
  ${if} $previousInstallDir != ""
  ${andIf} $previousInstallDir != "$INSTDIR"
    ${if} ${FileExists} "$previousInstallDir\${APP_EXECUTABLE_FILENAME}"
    ${orIf} ${FileExists} "$previousInstallDir\BeatGrid.exe"
      DetailPrint "Removing previous installation: $previousInstallDir"
      SetOutPath "$INSTDIR"
      ClearErrors
      RMDir /r /REBOOTOK "$previousInstallDir"
      ${if} ${Errors}
        DetailPrint "Previous installation is still in use and was left in place."
        ClearErrors
      ${endIf}
    ${else}
      DetailPrint "Skipping cleanup because the previous installation path is not recognized."
    ${endIf}
  ${endIf}
!macroend
