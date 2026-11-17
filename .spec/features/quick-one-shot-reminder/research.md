<!-- onp-spec:documentation-contract=v1 -->

# Pesquisa de produto: quick one shot reminder

> feature: quick-one-shot-reminder
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md)

## Pergunta e hipótese

- **Pergunta:** Como oferecer criação rápida de lembretes pontuais ("turn off the oven in 15 minutes") mantendo compatibilidade com os defaults globais, suporte a múltiplos lembretes simultâneos, som padrão e auto-remoção ao concluir?
- **Hipótese falsificável:** Adicionar suporte nativo a `oneShot` com `fireAt`/`delaySeconds` em `ConfigLoader`, som fallback `sounds/default-{type}-{N}.mp3` em `AudioPlayer` e uma view minimalista `#quickView` em `ManageRemindersWindow` reduz o atrito de criação para título + tempo enquanto reaproveita 100% da infraestrutura de popup, snooze, focus guard e áudio existente.

## Concorrentes e alternativas

| Produto / alternativa | Comportamento observado | Fonte primária | Data da consulta | Limitações |
|---|---|---|---|---|
| Fluxo atual (criar lembrete cron e excluir depois) | Exige preencher Título, ID único manual, expressão Cron válida e lembrar de deletar o lembrete depois do alerta | Código local (`src/ui/manage-reminders.html`, `src/core/ConfigLoader.js`) | 2026-11-17 | Lento para uso rápido ("in 15 minutes"), polui a agenda recorrente se esquecido e exige áudio `sounds/{id}-*` específico |
| Timer one-shot apenas em memória | Não grava em `config.json`; some se o app reiniciar ou travar | Análise arquitetural do repositório (`src/main.js`, `src/core/StateStore.js`) | 2026-11-17 | Perde lembretes pendentes em reinícios e não aproveita edição/cancelamento na lista |
| One-shot persistido em `config.json` + view `#quickView` + fallback `sounds/default-*` | Grava `oneShot: true` + `fireAt`, gera ID automático, usa som `default-*` e auto-exclui ao marcar `Done` | Análise local + entrevista `/grill-me` | 2026-11-17 | Requer atualização de lista na UI via IPC (`reminders-changed`) quando o item é excluído em segundo plano |

## Evidências e dados

- **Inventário observado na pasta `sounds/` (2026-11-17):** contém arquivos no formato `{id}-{type}-{N}.mp3` (`add-first-reminder-alert-1.mp3`, `drink-water-alert-1.mp3`, `drink-water-done-1..3.mp3`, `drink-water-snooze-1.mp3`, `play-with-tiago-alert-1.mp3`, `play-with-tiago-done-1.mp3`). Não existe prefixo `default` ainda; com o fallback em `AudioPlayer.pickRandom`, basta o usuário colocar `default-alert-1.mp3` (ou `done`/`snooze`) em `sounds/` para qualquer one-shot ou lembrete com `useDefaultSound !== false` utilizá-lo automaticamente.
- **Capacidade observada em `StateStore` e `ReminderService`:** cada lembrete possui `id` independente como chave em `data/state.json`, `activeReminders`, `shownReminders`, `deferredReminders` e `autoDismissTimers`, suportando naturalmente múltiplos lembretes simultâneos quando cada um recebe ID único.

## Viabilidade matemática e estatística

Não aplicável — feature determinística de temporização local (`setTimeout` sobre `fireAt - Date.now()`) sem coleta estatística ou experimento de amostra.

## Proposta e alternativas ao pedido

- **Recomendação adotada:** View `#quickView` em `ManageRemindersWindow`, menu `Quick one-shot reminder` no Tray, prefixo `sounds/default-{type}-{N}.mp3` com checkbox `Use default sound` (checked por padrão) nos formulários, presets `5m`/`10m`/`15m`/`30m`/`1h`/`2h` + entrada em minutos + modo `HH:MM`, persistência com badge `⚡ One-shot` e auto-exclusão somente do item marcado como `Done`.
- **Alternativa rejeitada:** Auto-excluir no primeiro disparo mesmo antes de `Done` — descartada pois impediria `Snooze` e `autoSnoozeTimeout` de funcionarem no one-shot.

## Decisão e experimento

- **Decisões literais do cliente (via `/grill-me`, 2026-11-17):**
  - Q-006: View dedicada `Quick Reminder` em `ManageRemindersWindow` + atalhos no Tray e cabeçalho.
  - Q-007: Prefixo `"sounds/default"` atuando como som de one-shot e fallback geral com checkbox `Use default sound` (marcada por padrão).
  - Q-008: Presets (`5m`, `10m`, `15m`, `30m`, `1h`) + input em minutos (default `15m`) + modo opcional `At HH:MM`.
  - Q-009: Persistir em `config.json` (badge `⚡ One-shot`), suportar Snooze/auto-snooze e deletar de `config.json` e `state.json` ao marcar `Done`.
  - Q-010: Formulário enxuto com `Advanced Options` colapsável.
  - Q-011: Suportar múltiplos quick reminders simultâneos sem limite e prosseguir sequencialmente.
- **Validação prevista:** `yarn test` (100% cobertura), `onp-spec verify configure-defaults-panel`, `onp-spec verify quick-one-shot-reminder` e `onp-spec audit --ci` com exit 0.
