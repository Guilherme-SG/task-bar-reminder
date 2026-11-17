<!-- onp-spec:documentation-contract=v1 -->

# PRD: quick one shot reminder

> feature: quick-one-shot-reminder
> status: revisado

[ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Pedido original do cliente

> /grill-me /onp-spec-driven Now, I need a new feature: a quick one shot reminder. When the user just need one time reminder like turn

## Problema, público e contexto

Pedido literal completo recebido em 2026-11-17 via sessão `/grill-me /onp-spec-driven`:
`"Now, I need a new feature: a quick one shot reminder. When the user just need one time reminder like "turn off the oven in 15 minutes", he doesn't want to configure a whole reminder and have to cancel after it. It should use the same configs as a normal reminder, but use a default sound for these alert and when marked as done It is deleted from system."`

Hoje, criar um lembrete pontual no `task-bar-reminder` obriga o usuário a preencher ID em kebab-case, escolher ou digitar expressões cron recorrentes e depois excluir manualmente o lembrete após concluí-lo — além de exigir arquivos `sounds/{id}-*.mp3` específicos por ID para ter áudio.

Com base na entrevista `/grill-me`, a solução oferece:
- Visualização dedicada **Quick Reminder** em `ManageRemindersWindow` (acessível pelo Tray e pelo cabeçalho), com geração automática de ID único (`oneshot-...`) permitindo **múltiplos lembretes one-shot simultâneos e independentes**.
- Escolha ágil de tempo via presets (`5m`, `10m`, `15m`, `30m`, `1h`, `2h`), entrada personalizada em minutos (padrão `15`) ou horário exato (`HH:MM`).
- Uso da convenção de som padrão `sounds/default-{type}-{N}.mp3` para one-shots e como **fallback configurável** para qualquer lembrete por meio da checkbox `Use default sound` (marcada por padrão).
- Persistência em `config.json` (sobrevivendo reinícios e permitindo cancelamento/edição na lista com badge `⚡ One-shot`), suporte a Snooze/auto-snooze e **auto-exclusão** de `config.json`, `state.json`, fila/timers e UI apenas do lembrete marcado como `Done`.

## Resultados desejados e métricas

- **Resultado para o cliente:** Criar um lembrete único em segundos sem configurar cron ou ID manual, suportando quantos lembretes rápidos simultâneos o usuário quiser, com som padrão fallback e limpeza automática ao marcar `Done`.
- **Linha de base observada:** 0 suporte a agendamento pontual (`oneShot`/`fireAt`), 0 fallback de som `sounds/default-*`, 0 auto-exclusão ao concluir.
- **Meta:** Criação rápida em ~2 cliques/campos (Título + Tempo), 100% dos critérios `AC-008`..`AC-014` provados pelo runner Jest, 100% de cobertura global e `onp-spec audit --ci` com saída 0.
- **Fonte de verificação:** suíte Jest (`yarn test`) e `onp-spec verify quick-one-shot-reminder` / `onp-spec audit --ci`.

## Requisitos e prioridades

| Requisito | Palavras do cliente / origem | Prioridade | Critérios na spec |
|---|---|---|---|
| Gerar IDs únicos e validar `oneShot` com `delaySeconds`/`fireAt` | "doesn't want to configure a whole reminder" + "as many quick reminder as they want" (`/grill-me`) | Alta | AC-008, AC-009 |
| Herdar configs normais (cor, snooze, auto-dismiss, blockWhenFocused) com opções avançadas colapsáveis | "It should use the same configs as a normal reminder" (`/grill-me`) | Alta | AC-009 |
| Som padrão `sounds/default-{type}-{N}.mp3` para one-shot e fallback configurável via `useDefaultSound` | "use a default sound for these alert" + decisão `/grill-me` (prefixo `default` + checkbox) | Alta | AC-010 |
| Agendar disparo único sem cron recorrente mantendo suporte a Snooze/auto-snooze | Decisão `/grill-me` sobre ciclo de vida e Snooze | Alta | AC-011 |
| Auto-excluir apenas o lembrete one-shot resolvido quando marcado como `Done` | "when marked as done It is deleted from system" + múltiplos concorrentes | Alta | AC-012 |
| Atalho no Tray e cabeçalho para abrir Quick Reminder | Decisão `/grill-me` de acesso e UI | Alta | AC-013 |
| Atualizar lista da UI quando um one-shot for removido automaticamente | Decisão `/grill-me` de sincronização de UI | Média | AC-014 |

## Escopo e exclusões

**No escopo:**
- Suporte a `oneShot: true`, `fireAt` (ISO string), `delaySeconds` (convertido em `fireAt` ao salvar), `useDefaultSound` (booleano, padrão implícito `true`) em `ConfigLoader`.
- Fallback de áudio em `AudioPlayer.pickRandom(id, type, { fallbackToDefault })` para `sounds/default-{type}-{N}.mp3`.
- Ciclo de vida one-shot em `ReminderService` (agendamento por `fireAt`, Snooze/auto-snooze sem cron recorrente, limpeza e exclusão automática em `Done` com `onOneShotDone`).
- Item `Quick one-shot reminder` no `AppTray`, canal IPC `reminders-changed` / `notifyRemindersChanged()` em `ManageRemindersWindow`, visualização `#quickView` e checkbox `Use default sound` em `manage-reminders.html` + wiring em `main.js`.

**Exclusões explícitas:**
- Não cria janela `BrowserWindow` separada só para quick reminders.
- Não cria novo campo em `config.json` para caminho de som padrão separado (usa convenção `sounds/default-{type}-{N}.mp3` na pasta `sounds/`).
- Não apaga todos os one-shots quando um deles é marcado como `Done` — somente o ID resolvido é removido.

## Regras de produto e domínios

- **Domínios afetados:** `config`, `core`, `ui`, `tray` — compartilhados com [PRD anterior](../configure-defaults-panel/prd.md) e [ADR anterior](../configure-defaults-panel/adr.md).
- **Invariantes preservados:**
  - Todas as regras de validação e herança de `configure-defaults-panel` (`getSettings`, `saveSettings`, `resetSettings`, herança de `color` e `blockWhenFocused`) permanecem intactas.
  - Lembretes recorrentes sem `oneShot` continuam exigindo `cron` válido e não sofrem auto-exclusão no `Done`.
  - Lembretes one-shot persistem em `config.json` e `data/state.json` até serem marcados como `Done` ou excluídos manualmente pelo usuário.

## Dependências, riscos e suposições

- **Dependência:** `ConfigLoader`, `AudioPlayer`, `ReminderService`, `ManageRemindersWindow`, `AppTray`, `StateStore`.
- **Risco:** Colisão de IDs quando dois lembretes rápidos com títulos parecidos são criados rapidamente no mesmo milissegundo. Mitigado por sufixo incremental em `ConfigLoader.generateOneShotId(title, existingIds)`.
- **Risco:** `ReminderWindow` ou `ManageRemindersWindow` exibir lista desatualizada após auto-exclusão em `Done`. Mitigado via callback `onOneShotDone` -> `ConfigLoader.deleteReminder(id)` + `notifyRemindersChanged()`.
- **Suposição vinculada:** ver [Spec](spec.md#suposições) (`ASM-002`).

## Validação com o cliente

Todas as decisões de produto foram validadas em entrevista `/grill-me` em 2026-11-17:

1. **Abertura e formulário (Q-006):** Visualização dedicada `Quick Reminder` em `ManageRemindersWindow` (aberta por item no Tray e botão `⚡ Quick Reminder` no cabeçalho), gerando ID automaticamente e ocultando campos de Cron.
2. **Som padrão e fallback (Q-007):** Prefixo `sounds/default` (`sounds/default-{type}-{N}.mp3`) usado para one-shots e também como fallback para qualquer lembrete, controlado por checkbox `Use default sound` (marcada por padrão) na criação/edição.
3. **Seleção de horário (Q-008):** Chips rápidos (`5m`, `10m`, `15m`, `30m`, `1h`, `2h`), entrada personalizada em minutos (padrão `15m`) e modo opcional por horário `HH:MM`.
4. **Ciclo de vida e Snooze (Q-009):** Persistir em `config.json` (visível com badge `⚡ One-shot` para sobreviver reinícios e poder ser cancelado), permitir Snooze/auto-snooze e auto-excluir de `config.json` e `state.json` apenas ao marcar `Done`.
5. **Opções avançadas no Quick Reminder (Q-010):** Formulário enxuto por padrão (Título, Tempo, Descrição opcional, `Use default sound`) com seção colapsável `Advanced Options` para Color, Snooze, Auto-dismiss e Block When Focused.
6. **Concorrência e impacto nos domínios compartilhados (Q-011):** O usuário pode ter quantos quick reminders simultâneos desejar; aprovado prosseguir (`prosseguir`) estendendo os domínios compartilhados sequencialmente.
