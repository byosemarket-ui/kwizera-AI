# KWIZERA AI STUDIO
# FINAL WINDOWS MACHINE CERTIFICATION

**Generated:** 2026-08-26T02:44:07.738Z
**Verdict:** LIMITED PRODUCTION
**Version:** 0.1.0

## Machine
- OS: Windows_NT 10.0.19045
- Executable: C:\Users\Mrk\Desktop\kwizera-AI\release\win-unpacked\KWIZERA AI STUDIO.exe
- Setup: C:\Users\Mrk\Desktop\kwizera-AI\release\KwizeraAIStudio-Setup-0.1.0.exe
- Desktop shortcut → C:\Users\Mrk\Desktop\kwizera-AI\release\win-unpacked\KWIZERA AI STUDIO.exe

## Results

| ID | Status | Actual |
|----|--------|--------|
| build.setup-exe | PASS | 89MB |
| build.unpacked-exe | PASS | present |
| deploy.runtime-staged | PASS | already present |
| windows.desktop-shortcut | PASS | C:\Users\Mrk\Desktop\kwizera-AI\release\win-unpacked\KWIZERA AI STUDIO.exe |
| windows.shortcuts-script | PASS | 0 |
| installed.app-startup | PASS | storageRoot=C:\Users\Mrk\AppData\Local\KWIZERA-AI-STUDIO |
| installed.storage-root | PASS | C:\Users\Mrk\AppData\Local\KWIZERA-AI-STUDIO |
| installed.workspace-ready | PASS | ready |
| installed.create-project | PASS | 7c5c4f4b-2a9f-442d-ba53-f0791d4ba826 |
| installed.image-upload | PASS | 4052490e-5a05-4f7a-90f0-bbd3c8b41b5c |
| installed.filesystem-project | PASS | exists |
| installed.system-health | PASS | score=96 status=DEGRADED |
| installed.desktop-ui | PASS | HTTP 200 |
| ui.file-picker | SKIP | NOT RUN in harness |
| ui.drag-drop | SKIP | NOT RUN in harness |
| os.windows-reboot | SKIP | NOT RUN in harness |
| production.video-output | NOT CERTIFIED | NOT RUN — requires persistent AI runtime |

## Counts
- PASS: 13
- FAIL: 0
- LIMITED: 0
- SKIP: 3
- NOT CERTIFIED: 1
