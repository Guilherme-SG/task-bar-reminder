<!-- onp-spec:documentation-contract=v1 -->

# TDD: configure defaults panel

> feature: configure-defaults-panel
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## 1. Identificação e responsáveis

- **Autor / Responsável técnico:** Sessão Antigravity.
- **Dono do Produto / Participantes:** Usuário do projeto `task-bar-reminder`.
- **Data:** 2026-11-17 · **Versão:** 1.0.0 · **Estado:** revisado.

## 2. Contexto e sistema atual

O aplicativo `task-bar-reminder` roda em Electron (CommonJS) com janela de popup (`ReminderWindow`), gerenciamento de lembretes (`ManageRemindersWindow` + `manage-reminders.html`), bandeja (`AppTray`) e núcleo de agendamento/áudio/foco (`ConfigLoader`, `Scheduler`, `ReminderService`, `AudioPlayer`, `FocusGuard`, `ProcessList`, `StateStore`).

Atualmente:
- `ConfigLoader.load()` aplica `DEFAULTS` em memória sobre `config.json`, valida e converte `autoSnoozeTimeout` e `snoozeInterval` de segundos para ms.
- `ConfigLoader` expõe CRUD de lembretes (`saveReminder`, `updateReminder`, `deleteReminder`), mas não expõe leitura, validação isolada ou persistência das configurações globais padrão.
- `AudioPlayer`, `ReminderWindow` e `ReminderService` recebem `config` / `ffplayPath` apenas no construtor sem método de atualização em runtime.

## 3. Problema e motivação

Editar manualmente `config.json` e reiniciar o aplicativo cria atrito, risco de JSON inválido e impede experimentar rapidamente cor padrão, dimensões da janela de popup, tempos padrão de soneca/auto-dismiss, caminho do `ffplay` e lista global de aplicativos que bloqueiam popups. Além disso, o formulário de lembretes impedia herdar cor padrão e lista global `blockWhenFocused`.

## 4. Escopo e não objetivos

- **Entregas:**
  - `ConfigLoader.getDefaults()`, `validateSettings()`, `getSettings()`, `saveSettings()`, `resetSettings()` e suporte a limpeza de `color`/`blockWhenFocused` em `#normalizeReminder` (`AC-001`, `AC-002`, `AC-003`, `AC-007`).
  - `AudioPlayer.setFfplayPath()`, `ReminderWindow.updateConfig()`, `ReminderService.updateSettings()` (`AC-006`).
  - Item `Settings` em `AppTray` e view `'settings'` + botão de cabeçalho + alinhamento do `#formView` em `ManageRemindersWindow` e `manage-reminders.html` (`AC-004`, `AC-005`, `AC-007`).
  - Integração completa em `src/main.js` (`AC-004`, `AC-005`, `AC-006`).
- **Não objetivos:** Criação de janela separada, edição de `config.example.json`, validação de existência física de `ffplayPath` no disco ou migração de lembretes existentes.

## 5. Solução e arquitetura

```text
AppTray ("Settings") ──┐
                       ├──▶ ManageRemindersWindow.show('settings') ──▶ manage-reminders.html (#settingsView)
Header ("⚙️ Settings") ┘         │                                            │
                                 │ IPC (get-settings / save-settings /        │
                                 │      reset-settings / browse-ffplay-file)  │
                                 ▼                                            │
                           src/main.js ◀──────────────────────────────────────┘
                             ├──▶ ConfigLoader.getSettings / saveSettings / resetSettings (config.json em segundos)
                             └──▶ ReminderService.updateSettings(runtimeSettings em ms)
                                    ├──▶ AudioPlayer.setFfplayPath()
                                    ├──▶ ReminderWindow.updateConfig() + positionWindow()
                                    └──▶ FocusGuard.start()/stop() + releaseDeferredReminders()
```

**Contratos principais:**
- `ConfigLoader.getDefaults()` → `{ ffplayPath, autoSnoozeTimeout, snoozeInterval, blockWhenFocused, window: { width, height, defaultColor } }` (valores em segundos).
- `ConfigLoader.getSettings(filePath?)` → mesmos campos mesclados do arquivo + `defaults: ConfigLoader.getDefaults()`.
- `ConfigLoader.saveSettings(newSettings, filePath?)` → normaliza `blockWhenFocused` (string separada por vírgula ou array), valida via `validateSettings()`, grava preservando `raw.reminders || []`, retorna objeto runtime com tempos em ms (`* SECONDS_TO_MS`).
- `ConfigLoader.resetSettings(filePath?)` → chama `saveSettings(getDefaults(), filePath)`.
- IPC `ManageRemindersWindow`: `get-settings`, `save-settings`, `reset-settings`, `browse-ffplay-file`.

## 6. Riscos e mitigação

| Risco | Evidência / hipótese | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| Perda de `reminders` ao gravar `config.json` em `saveSettings` | `writeFileSync` reescreve o objeto raiz | Baixa | Alto | Ler `raw` do disco antes de gravar e preservar explicitamente `reminders: raw.reminders \|\| []` | Execução T-001 |
| Queda abaixo de 100% na cobertura Jest | `jest.config.js` falha o build com qualquer branch descoberto | Média | Alto | Cobrir 100% das linhas e branches de cada módulo alterado com testes unitários dedicados | Execução T-001..T-004 |
| Conflito de estado entre `selectedProcesses` no `#formView` e `#settingsView` | Ambos os formulários usam seletor de processos | Média | Médio | Manter conjuntos de seleção/elementos isolados (`settingsSelectedProcesses` vs `selectedProcesses`) em `manage-reminders.html` | Execução T-005 |
| Testes de `Tray.test.js` quebrarem por índice de menu fixo | `Tray.test.js` verifica `call[4]`, `call[5]` e `toHaveLength(6)`/`(9)` | Alta | Médio | Atualizar os índices esperados em `tests/ui/Tray.test.js` junto com os novos testes de `Settings` | Execução T-003 |

## 7. Plano de implementação

Execução sequencial em 5 tarefas (`T-001` a `T-005`) descritas em [Tarefas](tasks.md):
1. `T-001`: camada de configuração e validação em `ConfigLoader.js` + testes.
2. `T-002`: atualização em tempo de execução em `AudioPlayer.js`, `ReminderWindow.js`, `ReminderService.js` + testes.
3. `T-003`: entrada `Settings` no `Tray.js` + testes.
4. `T-004`: canais IPC de configurações em `ManageRemindersWindow.js` + testes.
5. `T-005`: interface `#settingsView`, alinhamento de herança no `#formView` em `manage-reminders.html` e ligação em `src/main.js`.

## 8. Segurança e privacidade

Não aplicável ao domínio de rede/autenticação — aplicativo desktop local sem servidor remoto, pagamento ou dados pessoais sensíveis. Mantém `escapeHtml` em conteúdos dinâmicos e não introduz segredos (`P-002`). Os diálogos de arquivo usam `dialog.showOpenDialog` restrito a `.exe` no contexto principal do Electron.

## 9. Estratégia de testes

- Cada critério `AC-001`..`AC-007` possui testes automatizados em Jest anotados com `@spec:AC-xxx` no título em `tests/core/` e `tests/ui/`.
- `src/main.js` e `src/ui/manage-reminders.html` permanecem fora do `collectCoverageFrom` de `jest.config.js`, conforme convenção já existente no projeto; sua integração será validada por inspeção direta dos contratos e revisão da suíte completa.
- Gate final: `yarn test` (100% coverage), `onp-spec verify configure-defaults-panel`, `onp-spec audit --ci`.

## 10. Operação e observabilidade

Não aplicável para telemetria remota — app desktop local. Erros de validação ao salvar ou restaurar são retornados via `{ success: false, error }` do IPC para exibição no `#settingsErrorBanner` na UI.

## 11. Reversão e recuperação

Como a persistência em `config.json` preserva `reminders` intactos e os valores padrão de fábrica ficam centralizados em `ConfigLoader.DEFAULTS`, o usuário pode reverter configurações a qualquer momento pelo botão `Restore All Defaults` ou por campo individual na UI, além de poder reverter commits Git por tarefa se necessário.

## 12. Métricas de sucesso

- 7/7 campos padrão de `ConfigLoader.DEFAULTS` editáveis e restauráveis na UI.
- 0 regressões nos 301 testes existentes.
- 100% statements, branches, functions e lines no `yarn test`.
- 0 erros e 0 avisos no `onp-spec audit --ci`.

## 13. Glossário e domínios

- **Padrões de fábrica (`DEFAULTS`):** Valores fixos em `ConfigLoader.js` (`ffplayPath: ''`, `autoSnoozeTimeout: 60`, `snoozeInterval: 300`, `blockWhenFocused: []`, `window: { width: 320, height: 220, defaultColor: '#1a1a2e' }`).
- **Configurações globais (`settings`):** Valores salvos na raiz de `config.json` que servem como fallback para lembretes que não definem sobrescrita própria.
- **Domínios:** `config`, `core`, `ui`, `tray`.

## 14. Alternativas e decisões

Resumo das decisões registradas no [ADR](adr.md): view integrada `'settings'` em `ManageRemindersWindow`, reset por campo + `Restore All Defaults` imediato, live reload via `ReminderService.updateSettings`, mínimos `width >= 200` / `height >= 120` e alinhamento de herança de `color` e `blockWhenFocused` no formulário de lembretes.

## 15. Dependências e compatibilidade

- Node.js `>=18`, Electron `^43.0.0`, Jest `^30.5.1`.
- Compatível com `config.json` existentes que omitam chaves opcionais (aplicação de `DEFAULTS` mantida).
- `FocusGuard` é Windows-only, já com guarda de existência nos métodos (`typeof this.focusGuard.stop === 'function'`).

## 16. Performance e capacidade

Leitura/escrita síncrona pontual de um único `config.json` pequeno (< 10 KB) apenas sob ação explícita do usuário (salvar/restaurar configurações), impacto desprezível (< 5 ms típico em SSD local). Não introduz loops ou timers extras.

## 17. Migração e implantação

Não há migração destrutiva de `config.json`. Configurações existentes continuam válidas. Lembretes existentes com `color` ou `blockWhenFocused` explícitos permanecem inalterados até que o usuário opte por editá-los para herdar os defaults globais.

## 18. Perguntas e suposições

Todas as perguntas (`Q-001`..`Q-005`) foram respondidas pelo usuário no `/grill-me` e registradas em [Spec](spec.md#perguntas-em-aberto) e [PRD](prd.md#validação-com-o-cliente). A suposição `ASM-001` está confirmada em [Spec](spec.md#suposições).

## 19. Marcos e acompanhamento

1. Especificação e governança aprovadas (`onp-spec impacto` + `onp-spec plano`).
2. `T-001` ConfigLoader + testes.
3. `T-002` Live reload em AudioPlayer, ReminderWindow e ReminderService + testes.
4. `T-003` e `T-004` Tray e IPC de ManageRemindersWindow + testes.
5. `T-005` UI HTML e wiring em `main.js`.
6. Verificação completa (`yarn test`, `onp-spec verify`, `onp-spec audit --ci`).

## 20. Revisão e rastreabilidade

- **Cadeia completa:** [PRD](prd.md) → [ADR](adr.md) → [TDD](design.md) → [Spec](spec.md) → [Tarefas](tasks.md) → [Pesquisa](research.md).
- **Rastreabilidade AC → Tarefa:** `AC-001..AC-003, AC-007` → `T-001`; `AC-006` → `T-002`; `AC-004` → `T-003, T-004, T-005`; `AC-005` → `T-004, T-005`; `AC-006, AC-007` → `T-005`.
- **Revisor:** Sessão Antigravity · **Data:** 2026-11-17.
