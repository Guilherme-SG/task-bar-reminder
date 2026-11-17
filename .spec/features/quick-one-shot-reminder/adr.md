<!-- onp-spec:documentation-contract=v1 -->

# ADR: quick one shot reminder

> feature: quick-one-shot-reminder
> status: revisado

[PRD](prd.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Identificação e contexto

- **Decisão:** Modelo de dados, convenção de som padrão fallback, agendamento sem cron e ciclo de auto-exclusão para múltiplos lembretes rápidos únicos (`oneShot`).
- **Responsáveis:** Sessão Antigravity + Dono do Produto (via `/grill-me`).
- **Data:** 2026-11-17.
- **Domínios:** `config`, `core`, `ui`, `tray`.
- **Requisitos atendidos:** `US-006` a `US-010` (`AC-008` a `AC-014`) em [Spec](spec.md) e [PRD](prd.md).

## Restrições e regras anteriores

- **Constituição do projeto:** `P-001` e `P-002` em [Constituição](../../constituicao.md).
- **Contratos vigentes:** [ADR anterior](../configure-defaults-panel/adr.md) e [Spec anterior](../configure-defaults-panel/spec.md) — mantidos integralmente (painel `'settings'`, live reload, herança de `color` e `blockWhenFocused`, mínimos de janela e 100% de cobertura Jest).
- **Convenções (`AGENTS.md`):** IDs kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), durações em segundos no JSON / ms no runtime, sons `sounds/{id}-{type}-{N}.mp3`.

## Alternativas consideradas

1. **Lembretes one-shot apenas em memória vs. persistidos em `config.json` com flag `oneShot: true`:**
   - *Benefício da persistência em `config.json`:* Sobrevive reinícios do app (`Restart` ou reboot), aparece na lista de gerenciamento com badge `⚡ One-shot` para cancelamento ou edição antecipada, e reaproveita validação/CRUD existentes.
2. **Som exclusivo `sounds/oneshot-*` vs. prefixo `sounds/default-*` como som padrão e fallback configurável (`useDefaultSound`):**
   - *Benefício do prefixo `default` + `useDefaultSound`:* Atende one-shots sem precisar de pasta dedicada, elimina o atrito de criar arquivos `sounds/{id}-*` para todo lembrete comum novo, e permite silenciar um lembrete desmarcando a checkbox.
3. **Janela separada para Quick Reminder vs. visualização `'quick'` em `ManageRemindersWindow`:**
   - *Benefício da view integrada:* Reutiliza CSS, `currentSettings`, seletor de processos, handlers IPC (`save-reminder`/`update-reminder`) e ciclo de vida da janela única de gerenciamento.

## Decisão e justificativa

1. **Estender o esquema de lembrete com `oneShot?: boolean`, `fireAt?: string` (ISO), `delaySeconds?: number` (entrada transitória normalizada para `fireAt`) e `useDefaultSound?: boolean` (default efetivo `true`).**
   - `ConfigLoader.generateOneShotId(title, existingIds)` gera `oneshot-<slug>-<timestamp>` (com desambiguação incremental) mantendo conformidade com kebab-case e suportando N lembretes simultâneos.
2. **Estender `AudioPlayer.pickRandom(id, type, { fallbackToDefault = true })`** para tentar `id` primeiro e cair para prefixo `'default'` quando nenhum arquivo de `id` existir e `fallbackToDefault` for `true`.
   - Em `ReminderService.#playSound`:
     - Se `reminder.oneShot && reminder.useDefaultSound === false`: silencioso.
     - Se `reminder.oneShot`: chama `pickRandom('default', soundType)`.
     - Se recorrente e `useDefaultSound === false`: chama `pickRandom(reminder.id, soundType, { fallbackToDefault: false })`.
     - Caso contrário: chama `pickRandom(reminder.id, soundType)` (com fallback ativo).
3. **Ciclo de vida one-shot em `ReminderService` + `main.js`:**
   - `#initReminder` e `#scheduleNext` usam `fireAt` (ou `stateStore`) sem recorrer ao `Scheduler` cron.
   - `Snooze` e auto-snooze usam `#scheduleTimeout(reminder, snoozeInterval, () => {})` sem reagendar cron.
   - `Done` limpa timer ativo, remove o lembrete da fila, conjuntos ativos e `config.reminders`, chama `stateStore.clearNextFireTime(id)` e dispara `onOneShotDone(id)` (que em `main.js` persiste a remoção via `ConfigLoader.deleteReminder(id)`, atualiza o Tray e chama `manageRemindersWindow.notifyRemindersChanged()`).

## Consequências e riscos

- **Positivas:** Zero configuração manual de cron/ID para alertas rápidos; reutilização completa de configs e live reload; fallback de som unificado; limpeza automática sem afetar outros one-shots ativos.
- **Riscos:** Se um one-shot expirado durante desligamento for disparado no startup via `stateStore` ou `fireAt <= now`, ele aparece imediatamente e aguarda `Done`/`Snooze` antes de ser excluído. Detalhes em [TDD](design.md#6-riscos-e-mitigação).

## Validade, revisão e substituição

- Complementa [ADR de configure-defaults-panel](../configure-defaults-panel/adr.md) sem substituí-lo.
- Revisar somente se o modelo de persistência sair de `config.json` ou se houver múltiplas janelas de configuração.

## Respostas e aprovação

- Aprovado pelo cliente em 2026-11-17 via ferramenta `ask_question` (`impacto:configure-defaults-panel` -> `prosseguir`), junto das decisões `Q-006`..`Q-011` registradas em [Spec](spec.md#perguntas-em-aberto).
