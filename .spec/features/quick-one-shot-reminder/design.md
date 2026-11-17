<!-- onp-spec:documentation-contract=v1 -->

# TDD: quick one shot reminder

> feature: quick-one-shot-reminder
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## 1. Identificação e responsáveis

- **Autor / Responsável técnico:** Sessão Antigravity.
- **Dono do Produto / Participantes:** Usuário do `task-bar-reminder`.
- **Data:** 2026-11-17 · **Versão:** 1.0.0 · **Estado:** revisado.

## 2. Contexto e sistema atual

Após a feature [configure-defaults-panel](../configure-defaults-panel/spec.md), o sistema possui configurações globais editáveis (`ffplayPath`, `autoSnoozeTimeout`, `snoozeInterval`, `blockWhenFocused`, `window.*`), live reload via `ReminderService.updateSettings()` e interface multi-view em `ManageRemindersWindow`. Entretanto, todos os lembretes atuais exigem `cron` recorrente, ID manual e som dedicado por ID (`sounds/{id}-{type}-{N}.mp3`), sem suporte a timers pontuais auto-removíveis.

## 3. Problema e motivação

Lembretes pontuais como "desligar o forno em 15 minutos" não devem exigir configuração de cron nem limpeza manual posterior. Além disso, novos lembretes sem pasta/arquivos de áudio personalizados ficam silenciosos sem um som padrão de fallback configurável.

## 4. Escopo e não objetivos

- **Entregas:**
  - `ConfigLoader.generateOneShotId()`, validação de `oneShot`/`fireAt`/`useDefaultSound` e normalização de `delaySeconds` (`AC-008`, `AC-009`, `AC-010`).
  - `AudioPlayer.pickRandom(id, type, { fallbackToDefault })` com fallback para `sounds/default-{type}-{N}.mp3` (`AC-010`).
  - `ReminderService`: ciclo completo one-shot (agendamento por `fireAt`, `Snooze`/auto-snooze sem cron, auto-remoção em `Done` e `onOneShotDone`, seleção de som via `useDefaultSound`) (`AC-010`, `AC-011`, `AC-012`).
  - `AppTray` (`Quick one-shot reminder`), `ManageRemindersWindow.notifyRemindersChanged()` (`AC-013`, `AC-014`).
  - `#quickView`, checkbox `Use default sound` no `#formView`, badges/edição de one-shot na lista em `manage-reminders.html` e wiring em `main.js` (`AC-008`..`AC-014`).
- **Não objetivos:** Janela separada para quick reminder, configuração de arquivo de som fora de `sounds/`, ou exclusão em massa de outros one-shots ao concluir um deles.

## 5. Solução e arquitetura

```text
Tray ("Quick one-shot reminder") ─┐
Header ("⚡ Quick Reminder") ─────┴─▶ ManageRemindersWindow.show('quick') ─▶ #quickView
                                                                                 │ save-reminder (oneShot: true, delaySeconds/fireAt, useDefaultSound)
                                                                                 ▼
                                                                      ConfigLoader.saveReminder()
                                                                                 │
                                                                                 ▼
                                                                      ReminderService.addReminder()
                                                                        ├─ #scheduleNext (fireAt - now)
                                                                        ├─ #playSound ('default' fallback / useDefaultSound)
                                                                        └─ resolveReminder(id, 'done')
                                                                             ├─ clear timeout/queue/stateStore/config.reminders
                                                                             └─ onOneShotDone(id) ─▶ ConfigLoader.deleteReminder(id) + notifyRemindersChanged()
```

**Contratos principais:**
- **Schema de lembrete one-shot em `config.json`:**
  - `id`: kebab-case único (gerado automaticamente por `ConfigLoader.generateOneShotId` se omitido na criação).
  - `title`: string obrigatória.
  - `oneShot`: `true` (booleano).
  - `fireAt`: string ISO-8601 válida (calculada de `Date.now() + delaySeconds * 1000` se `delaySeconds > 0` for enviado no payload).
  - `useDefaultSound`: booleano opcional (ausente ou `true` habilita som padrão/fallback; `false` desabilita).
  - Demais campos opcionais compartilhados (`description`, `color`, `snoozeInterval`, `autoSnoozeTimeout`, `blockWhenFocused`).
- **`AudioPlayer.pickRandom(id, type, { fallbackToDefault = true } = {})`:** busca `${id}-${type}-*.mp3`; se vazio e `fallbackToDefault && id !== 'default'`, busca `default-${type}-*.mp3`.
- **IPC:** reutiliza `save-reminder` / `update-reminder` / `delete-reminder` / `get-reminders`, adicionando push unidirecional `reminders-changed` do main para o renderer quando `onOneShotDone` apaga um item.

## 6. Riscos e mitigação

| Risco | Evidência / hipótese | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| Colisão de ID em dois quick reminders criados no mesmo ms ou com título igual | `Date.now()` pode repetir em execução rápida/testes | Média | Médio | `generateOneShotId` verifica `existingIds.has(candidate)` e incrementa sufixo `-2`, `-3`, ... | Execução T-006 |
| `ReminderService` tentar chamar `Scheduler.getNextFireTime(undefined)` para one-shot | Lembretes one-shot não possuem `cron` | Alta | Alto | Guardar todos os caminhos (`#initReminder`, `#scheduleNext`, `#scheduleTimeout`, `resolveReminder` snooze) com `if (reminder.oneShot)` | Execução T-008 |
| Exclusão de um one-shot em `Done` afetar outros one-shots concorrentes | Mutação de `this.config.reminders` e `state.json` | Baixa | Alto | Filtrar/remover estritamente pelo `reminderId` específico; testar múltiplos one-shots ativos simultaneamente | Execução T-008 |
| Lista em `ManageRemindersWindow` ficar obsoleta após `Done` no popup/tray | Usuário pode manter janela aberta em segundo plano | Média | Baixo | Emitir `notifyRemindersChanged()` em `onOneShotDone` e recarregar lista se `currentMode === 'list'` | Execução T-009, T-010 |

## 7. Plano de implementação

Execução sequencial em 5 tarefas (`T-006` a `T-010`) detalhadas em [Tarefas](tasks.md):
1. `T-006`: `ConfigLoader.js` + `ConfigLoader.test.js` (`AC-008`, `AC-009`, `AC-010`).
2. `T-007`: `AudioPlayer.js` + `AudioPlayer.test.js` (`AC-010`).
3. `T-008`: `ReminderService.js` + `ReminderService.test.js` (`AC-010`, `AC-011`, `AC-012`).
4. `T-009`: `Tray.js`, `ManageRemindersWindow.js` + testes (`AC-013`, `AC-014`).
5. `T-010`: `manage-reminders.html` (`#quickView`, checkbox `Use default sound`, badges, listener `reminders-changed`) + wiring em `main.js`.

## 8. Segurança e privacidade

Não aplicável a rede/autenticação — dados locais em `config.json` e `data/state.json`. Conteúdos renderizados na UI continuam usando `textContent` ou `escapeHtml` (`P-002` mantido sem segredos).

## 9. Estratégia de testes

- Cada critério `AC-008`..`AC-014` tem testes unitários explícitos anotados com `@spec:AC-xxx` em `tests/core/` e `tests/ui/`.
- Cobertura global de 100% obrigatória via `yarn test` em `src/core/**/*.js` e `src/ui/**/*.js`.
- Regressão: rodar também `onp-spec verify configure-defaults-panel` após as mudanças nos módulos compartilhados.

## 10. Operação e observabilidade

Não aplicável para telemetria externa. Erros de validação em `#quickView` são exibidos no `#quickErrorBanner`; remoção automática após `Done` ocorre com `try/catch` defensivo no callback `onOneShotDone` em `src/main.js`.

## 11. Reversão e recuperação

Lembretes one-shot pendentes ficam persistidos em `config.json` e `data/state.json`, permitindo recuperação automática em reinicializações. Se necessário reverter a feature, commits por tarefa no Git restauram os módulos mantendo `config.json` compatível.

## 12. Métricas de sucesso

- Criação de quick reminder em 1 tela dedicada sem campo cron nem ID manual.
- Suporte ilimitado a múltiplos one-shots simultâneos sem interferência cruzada.
- `100%` coverage em `yarn test`, `7/7` ACs provados em `configure-defaults-panel`, `7/7` ACs (`AC-008`..`AC-014`) provados em `quick-one-shot-reminder`, `0` erros/avisos em `onp-spec audit --ci`.

## 13. Glossário e domínios

- **One-shot (`oneShot: true`):** Lembrete único agendado por timestamp absoluto (`fireAt`) que é excluído ao ser concluído (`Done`).
- **Som padrão fallback (`sounds/default-{type}-{N}.mp3`):** Áudios genéricos na pasta `sounds/` usados por one-shots e por lembretes regulares quando `useDefaultSound` não for `false` e não houver áudio específico do ID.
- **Domínios:** `config`, `core`, `ui`, `tray`.

## 14. Alternativas e decisões

Resumo no [ADR](adr.md): persistência em `config.json`, prefixo `default` + checkbox `useDefaultSound`, view integrada `#quickView` com presets + minutos + `HH:MM` e seção `Advanced Options` colapsável.

## 15. Dependências e compatibilidade

- Node `>=18`, Electron `^43.0.0`, Jest `^30.5.1`.
- Lembretes existentes sem `oneShot` ou `useDefaultSound` no `config.json` continuam válidos e passam a herdar `useDefaultSound !== false` (fallback para `sounds/default-*` caso exista).

## 16. Performance e capacidade

Cada quick reminder adiciona apenas 1 `setTimeout` nativo do Node.js e 1 entrada leve em `config.json` / `state.json`. Escalável para dezenas de lembretes simultâneos com overhead de CPU/memória desprezível (< 1 ms por operação).

## 17. Migração e implantação

Sem migração destrutiva. Lembretes já presentes no `config.json` não precisam de novos campos obrigatórios (`oneShot` e `useDefaultSound` são opcionais).

## 18. Perguntas e suposições

Todas as perguntas (`Q-006`..`Q-011`) foram respondidas pelo usuário no `/grill-me` e a decisão de impacto `impacto:configure-defaults-panel` foi confirmada (`prosseguir`). Ver [Spec](spec.md#suposições) e [Spec](spec.md#perguntas-em-aberto).

## 19. Marcos e acompanhamento

1. Especificação, impacto e plano sequencial gerados (`onp-spec impacto` + `onp-spec plano`).
2. `T-006` ConfigLoader + testes.
3. `T-007` AudioPlayer fallback + testes.
4. `T-008` ReminderService one-shot + testes.
5. `T-009` Tray + ManageRemindersWindow + testes.
6. `T-010` UI (`manage-reminders.html`) + `main.js`.
7. Verificação integral (`yarn test`, `verify` de ambas as features, `audit --ci`).

## 20. Revisão e rastreabilidade

- **Cadeia completa:** [PRD](prd.md) → [ADR](adr.md) → [TDD](design.md) → [Spec](spec.md) → [Tarefas](tasks.md) → [Pesquisa](research.md).
- **Rastreabilidade AC → Tarefa:** `AC-008, AC-009` → `T-006, T-010`; `AC-010` → `T-006, T-007, T-008, T-010`; `AC-011, AC-012` → `T-008, T-010`; `AC-013, AC-014` → `T-009, T-010`.
- **Revisor:** Sessão Antigravity · **Data:** 2026-11-17.
