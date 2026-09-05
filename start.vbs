Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = projectDir
WshShell.Run "npx electron .", 0, False
Set WshShell = Nothing
Set fso = Nothing
