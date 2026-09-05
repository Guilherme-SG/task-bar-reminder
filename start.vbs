Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node src/main.js", 0, False
Set WshShell = Nothing
