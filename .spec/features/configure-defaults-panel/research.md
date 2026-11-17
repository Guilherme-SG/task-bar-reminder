<!-- onp-spec:documentation-contract=v1 -->

# Pesquisa de produto: configure defaults panel

> feature: configure-defaults-panel
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md)

## Pergunta e hipótese

- **Pergunta:** Qual modelo de painel de configurações e de retorno ao padrão atende melhor um aplicativo desktop leve de bandeja (`task-bar-reminder`) onde o usuário precisa ajustar defaults de `config.json` sem editar JSON manualmente?
- **Hipótese falsificável:** Integrar uma visualização `settings` na janela existente `ManageRemindersWindow` com aplicação imediata (live reload), reset por campo e restauração global completa elimina a necessidade de edição manual de `config.json` e evita dessincronização entre configurações globais e overrides por lembrete.

## Concorrentes e alternativas

| Produto / alternativa | Comportamento observado | Fonte primária | Data da consulta | Limitações |
|---|---|---|---|---|
| Estado atual (edição manual de `config.json`) | Usuário edita JSON manualmente seguindo `config.example.json` e reinicia o app pela bandeja (`Restart`) | Código-fonte local (`src/core/ConfigLoader.js`, `src/main.js`, `AGENTS.md`) | 2026-11-17 | Exige conhecimento de sintaxe JSON, unidades em segundos e reinicialização; sem feedback imediato de erro antes de reiniciar |
| Janela Electron separada (`SettingsWindow`) | Cria um segundo `BrowserWindow` dedicado com HTML/CSS e handlers IPC próprios para processos | Arquitetura local (`src/ui/ManageRemindersWindow.js`, `src/ui/manage-reminders.html`) | 2026-11-17 | Duplica o seletor de processos (`ProcessList`), CSS e gerenciamento de janela para apenas 7 campos |
| View `'settings'` integrada em `ManageRemindersWindow` | Reutiliza janela, estilo, seletor de processos e comunicação IPC, abrindo direto no modo `'settings'` via Tray ou cabeçalho | Código local (`src/ui/ManageRemindersWindow.js`, `src/ui/Tray.js`) e decisão do usuário no `/grill-me` | 2026-11-17 | Não permite exibir lista de lembretes e configurações lado a lado simultaneamente (aceito pelo tamanho enxuto da janela) |

## Evidências e dados

- **Inventário real de `DEFAULTS` observado em `src/core/ConfigLoader.js` (linhas 9-15):**
  1. `ffplayPath` (`''`)
  2. `autoSnoozeTimeout` (`60` segundos)
  3. `snoozeInterval` (`300` segundos)
  4. `blockWhenFocused` (`[]`)
  5. `window.width` (`320` px)
  6. `window.height` (`220` px)
  7. `window.defaultColor` (`'#1a1a2e'`)
- **Lacuna identificada no código existente (`src/ui/manage-reminders.html` linhas 1046-1047 e 1475-1492):** ao salvar um lembrete sem customizações, o formulário enviava `color` preenchido com `#1e3a5f` e `blockWhenFocused: []`, impedindo que lembretes criados pela UI herdassem `window.defaultColor` ou `blockWhenFocused` globais.

## Viabilidade matemática e estatística

Não aplicável — trata-se de feature determinística de interface desktop local sem experimento de conversão, telemetria estatística ou modelo probabilístico. O escopo foi dimensionado diretamente sobre os 7 campos de `DEFAULTS` em `ConfigLoader.js` e a restrição determinística de 100% de cobertura do `jest.config.js`.

## Proposta e alternativas ao pedido

- **Recomendação adotada:** Painel `'settings'` em `ManageRemindersWindow` + botão `Settings` no Tray + reset por campo e global ("Restore All Defaults") + live reload (`ReminderService.updateSettings`, `AudioPlayer.setFfplayPath`, `ReminderWindow.updateConfig`) + suporte de herança no formulário de lembretes.
- **Alternativa descartada:** Somente salvar no arquivo e pedir reinício do app — rejeitada pelo cliente no `/grill-me` em favor de aplicação imediata ao vivo.

## Decisão e experimento

- **Resposta literal do cliente (via `/grill-me`, 2026-11-17):**
  - Q1: *"(Recommended) Built into ManageRemindersWindow as a new view ('settings' mode), accessible from both a 'Settings' tray menu item and a '⚙️ Settings' button in the Manage Reminders header"*
  - Q2: *"(Recommended) Both: a 'Restore All Defaults' button (saves & applies factory defaults after confirmation) and per-field reset actions in the form, never touching saved reminders"*
  - Q3: *"(Recommended) Update the Add/Edit Reminder form so reminders can inherit global defaults for Color and Block When Focused (and show current global defaults in Snooze/Auto-dismiss placeholders)"*
  - Q4: *"(Recommended) Apply all changes live immediately on save/reset (update timers/defaults, ffplayPath, FocusGuard, and resize/reposition ReminderWindow without restarting)"*
  - Q5: *"(Recommended) Enforce sensible minimums for window size (width >= 200, height >= 120) and allow any string for ffplayPath (with a file-picker button in the UI)"*
- **Validação prevista:** Testes unitários Jest com 100% de cobertura (`yarn test`), prova por critério (`onp-spec verify configure-defaults-panel`) e auditoria CI (`onp-spec audit --ci`).
