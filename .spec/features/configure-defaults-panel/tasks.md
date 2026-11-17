<!-- onp-spec:documentation-contract=v1 -->

# Tasks: Configure defaults panel

> feature: configure-defaults-panel

## T-001 — Implementar leitura, validação, salvamento, reset e normalização de herança no ConfigLoader [concluida]

- Refs: US-001, AC-001, AC-002, AC-003, US-005, AC-007
- Arquivos: src/core/ConfigLoader.js, tests/core/ConfigLoader.test.js
- Notas: Adicionar `getDefaults`, `validateSettings`, `getSettings`, `saveSettings`, `resetSettings` e suporte a `color: null` / `blockWhenFocused: null` em `#normalizeReminder` com 100% de cobertura.

## T-002 — Implementar atualização ao vivo de configurações nos serviços principais e janela de popup [concluida]

- Refs: US-004, AC-006
- Arquivos: src/core/AudioPlayer.js, src/ui/ReminderWindow.js, src/core/ReminderService.js, tests/core/AudioPlayer.test.js, tests/ui/ReminderWindow.test.js, tests/core/ReminderService.test.js
- Notas: Adicionar `AudioPlayer.setFfplayPath`, `ReminderWindow.updateConfig` e `ReminderService.updateSettings` com start/stop de `FocusGuard` e liberação de pendentes, mantendo 100% de cobertura.

## T-003 — Adicionar entrada Settings no menu da bandeja (AppTray) [concluida]

- Refs: US-002, AC-004
- Arquivos: src/ui/Tray.js, tests/ui/Tray.test.js
- Notas: Adicionar callback `onOpenSettings` e item `'Settings'` após `'Open sounds folder'`, atualizando asserções e cobrindo 100% em `Tray.test.js`.

## T-004 — Expor canais IPC de configurações e seleção de ffplay em ManageRemindersWindow [concluida]

- Refs: US-002, AC-004, US-003, AC-005
- Arquivos: src/ui/ManageRemindersWindow.js, tests/ui/ManageRemindersWindow.test.js
- Notas: Registrar `get-settings`, `save-settings`, `reset-settings` e `browse-ffplay-file` com setters e tratamento de erro/ausência de handler.

## T-005 — Implementar visualização Settings e herança de defaults na UI e integrar wiring no main.js [concluida]

- Refs: US-002, AC-004, US-003, AC-005, US-004, AC-006, US-005, AC-007
- Arquivos: src/ui/manage-reminders.html, src/main.js
- Notas: Construir `#settingsView` (todos os 7 campos padrão, reset por campo, `Restore All Defaults`, picker de `ffplay.exe`, seletor de processos global), atualizar `#formView` (checkbox cor padrão, seletor de modo de bloqueio, placeholders dinâmicos) e conectar callbacks em `src/main.js`.

## Documentos relacionados

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Pesquisa](research.md)
