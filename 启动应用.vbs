' NEXUS dashboard - hidden launcher (no black console window).
' Double-click this file to start the app just like a normal GUI application.
Option Explicit

Dim ws, fso, here, batName, batPath, env, rc, msg
Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
' Build the Chinese launcher filename from Unicode code points,
' keeping this script pure ASCII to avoid any UTF-8/ANSI encoding issues.
batName = ChrW(&H4E00) & ChrW(&H952E) & ChrW(&H542F) & ChrW(&H52A8) & ".bat"
batPath = fso.BuildPath(here, batName)

If Not fso.FileExists(batPath) Then
  MsgBox "Launcher not found: " & batName, 16, "NEXUS"
  WScript.Quit 1
End If

' NEXUS_HIDDEN tells the batch to skip its "pause" (invisible console would hang forever).
Set env = ws.Environment("Process")
env("NEXUS_HIDDEN") = "1"

' Window style 0 = hide the console; True = wait so we can report a failed startup.
rc = ws.Run("""" & batPath & """", 0, True)
If rc <> 0 Then
  ' Build Chinese message from Unicode code points (file stays pure ASCII).
  msg = "NEXUS " & ChrW(&H542F) & ChrW(&H52A8) & ChrW(&H5931) & ChrW(&H8D25) & ChrW(&HFF0C) & ChrW(&H8BF7) & ChrW(&H67E5) & ChrW(&H770B) & ChrW(&H76EE) & ChrW(&H5F55) & ChrW(&H4E0B) & ChrW(&H7684) & ChrW(&H300C) & ChrW(&H542F) & ChrW(&H52A8) & ChrW(&H65E5) & ChrW(&H5FD7) & ".txt" & ChrW(&H300D) & ChrW(&H83B7) & ChrW(&H53D6) & ChrW(&H8BE6) & ChrW(&H7EC6) & ChrW(&H62A5) & ChrW(&H9519) & ChrW(&H3002)
  MsgBox msg, 48, "NEXUS"
End If
