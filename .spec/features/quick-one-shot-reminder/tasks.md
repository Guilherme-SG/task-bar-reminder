<!-- onp-spec:documentation-contract=v1 -->

# Tasks: Quick one shot reminder

> feature: quick-one-shot-reminder

## T-006 — Implementar geração de ID, validação e normalização de lembretes one-shot e useDefaultSound no ConfigLoader [concluida]

- Refs: US-006, AC-008, AC-009, US-007, AC-010
- Arquivos: src/core/ConfigLoader.js, tests/core/ConfigLoader.test.js
- Notas: Adicionar `generateOneShotId`, suporte a `oneShot`, `fireAt`, `delaySeconds`, `useDefaultSound` em `validateReminder`/`#normalizeReminder`, mantendo 100% de cobertura.

## T-007 — Implementar fallback para sounds/default-{type}-{N}.mp3 no AudioPlayer [concluida]

- Refs: US-007, AC-010
- Arquivos: src/core/AudioPlayer.js, tests/core/AudioPlayer.test.js
- Notas: Atualizar `pickRandom(id, type, { fallbackToDefault = true })` e extrair `#matchSoundFiles` sem duplicar lógica de matching.

## T-008 — Implementar ciclo de vida one-shot, seleção de som padrão e limpeza automática em Done no ReminderService [concluida]

- Refs: US-007, AC-010, US-008, AC-011, AC-012
- Arquivos: src/core/ReminderService.js, tests/core/ReminderService.test.js
- Notas: Atualizar `#initReminder`, `#scheduleNext`, `#scheduleTimeout`, `#playSound` e `resolveReminder` para one-shots concorrentes e callback `onOneShotDone`.

## T-009 — Adicionar atalho Quick one-shot reminder no Tray e notificação reminders-changed em ManageRemindersWindow [concluida]

- Refs: US-009, AC-013, US-010, AC-014
- Arquivos: src/ui/Tray.js, src/ui/ManageRemindersWindow.js, tests/ui/Tray.test.js, tests/ui/ManageRemindersWindow.test.js
- Notas: Adicionar `onQuickReminder` + item `'Quick one-shot reminder'` no `AppTray` e `notifyRemindersChanged()` em `ManageRemindersWindow`.

## T-010 — Construir view Quick Reminder, checkbox Use default sound e wiring no main.js [concluida]

- Refs: US-006, AC-008, AC-009, US-007, AC-010, US-008, AC-011, AC-012, US-009, AC-013, US-010, AC-014
- Arquivos: src/ui/manage-reminders.html, src/main.js
- Notas: Adicionar botão `⚡ Quick Reminder`, `#quickView` com presets/minutos/`HH:MM` e `<details>` avançado, checkbox `Use default sound` em `#formView` e `#quickView`, badge `⚡ One-shot` na lista, listener `reminders-changed` e callbacks em `src/main.js`.

## Documentos relacionados

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Pesquisa](research.md)
