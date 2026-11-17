<!-- onp-spec:documentation-contract=v1 -->

# Spec: Quick one shot reminder

> feature: quick-one-shot-reminder
> status: auditada

## Contexto

Permite que o usuário crie rapidamente quantos lembretes únicos (one-shot) desejar — como "desligar o forno em 15 minutos" — herdando as configurações padrão, usando `sounds/default-{type}-{N}.mp3` como som padrão/fallback configurável, suportando soneca e excluindo automaticamente o lembrete ao marcá-lo como concluído (`Done`).

## Histórias

### US-006 — Criação e persistência de múltiplos lembretes rápidos únicos (one-shot)

Como usuário do aplicativo,
quero criar quantos lembretes rápidos únicos eu quiser informando apenas título e tempo (ou horário),
para agendar avisos pontuais sem configurar IDs manuais nem regras cron.

#### AC-008 — Gerar IDs únicos automaticamente e validar lembretes one-shot com delaySeconds ou fireAt

- **Dado** um lembrete rápido (`oneShot: true`) com título e `delaySeconds` positivo (ou timestamp ISO `fireAt` válido), sem `id` ou `cron` informado,
- **Quando** `ConfigLoader.saveReminder()` valida e grava o lembrete em `config.json`,
- **Então** o sistema gera um `id` kebab-case único (`oneshot-...`) sem colidir com IDs existentes, converte `delaySeconds` para `fireAt` ISO, rejeita valores inválidos e não exige `cron`.

#### AC-009 — Permitir múltiplos lembretes one-shot simultâneos preservando configurações padrão e overrides

- **Dado** múltiplos lembretes `oneShot: true` criados em sequência com títulos iguais ou diferentes e opções padrão ou customizadas (`color`, `snoozeInterval`, `autoSnoozeTimeout`, `blockWhenFocused`),
- **Quando** são salvos e carregados pelo `ConfigLoader`,
- **Então** cada um recebe um identificador único distinto, coexiste com os demais no `config.json` e preserva todas as configurações e overrides de um lembrete normal.

---

### US-007 — Som padrão (sounds/default-*) como som de one-shot e fallback configurável

Como usuário criando lembretes rápidos ou recorrentes,
quero que eles utilizem os arquivos `sounds/default-{type}-{N}.mp3` quando não houver som específico do ID e que isso possa ser ligado ou desligado por lembrete,
para ter áudio imediato sem gravar arquivos por ID ou silenciar lembretes específicos quando preferir.

#### AC-010 — Usar sounds/default-{type}-{N}.mp3 como fallback e respeitar a flag useDefaultSound

- **Dado** a pasta `sounds/` contendo arquivos `default-{type}-{N}.mp3` (ou específicos `{id}-{type}-{N}.mp3`) e lembretes com `useDefaultSound` ativo (`true`/omitido) ou desativado (`false`),
- **Quando** `AudioPlayer.pickRandom()` e `ReminderService` selecionam o áudio de `alert`, `done` ou `snooze`,
- **Então** one-shots tocam `default-{type}-{N}.mp3` (ou silenciam se `useDefaultSound === false`), e lembretes recorrentes caem para `default-{type}-{N}.mp3` quando não têm som próprio e `useDefaultSound !== false`.

---

### US-008 — Agendamento, soneca e auto-exclusão ao concluir (Done)

Como usuário recebendo um lembrete rápido,
quero poder adiá-lo com Snooze se necessário e tê-lo removido automaticamente apenas quando eu marcar como Done,
para nunca precisar cancelar manualmente um lembrete único depois que ele terminou.

#### AC-011 — Agendar e disparar lembrete one-shot sem reagendamento recorrente, mantendo suporte a Snooze

- **Dado** um lembrete `oneShot: true` agendado por `fireAt` ou restaurado pelo `StateStore`,
- **Quando** o horário é atingido ou o usuário aciona `Snooze` (ou `autoSnoozeTimeout` expira),
- **Então** o lembrete dispara no tempo restante (ou imediatamente se expirado) sem consultar o `Scheduler` cron, e após `Snooze` reaparece no intervalo de soneca sem criar novo agendamento recorrente.

#### AC-012 — Excluir automaticamente apenas o lembrete one-shot concluído ao marcar como Done

- **Dado** um ou mais lembretes `oneShot: true` ativos junto com lembretes normais,
- **Quando** o usuário resolve um lembrete `oneShot` com ação `done`,
- **Então** apenas esse lembrete tem seus timers limpos, é removido de `config.reminders` e `StateStore`, e dispara o callback `onOneShotDone(reminderId)` mantendo os demais lembretes intactos.

---

### US-009 — Acesso rápido pela bandeja e janela de gerenciamento

Como usuário no dia a dia,
quero abrir a tela de lembrete rápido diretamente pelo menu da bandeja ou pelo cabeçalho da janela de gerenciamento,
para iniciar um timer pontual em poucos cliques.

#### AC-013 — Abrir a visualização Quick Reminder pelo menu da bandeja (Tray) e pelo cabeçalho

- **Dado** o menu da bandeja `AppTray` e a janela `ManageRemindersWindow`,
- **Quando** o usuário clica no item `Quick one-shot reminder` da bandeja ou chama `manageRemindersWindow.show('quick')`,
- **Então** o callback `onQuickReminder` é acionado e a janela abre na visualização `'quick'` (`init-view` com `mode: 'quick'`).

---

### US-010 — Notificação de atualização da lista de lembretes ao concluir one-shot

Como usuário visualizando a lista de lembretes enquanto um one-shot é concluído,
quero que a lista da janela de gerenciamento seja notificada para recarregar automaticamente,
para não ver um lembrete rápido que já foi excluído do sistema.

#### AC-014 — Notificar a janela de gerenciamento quando a lista de lembretes mudar em tempo de execução

- **Dado** a janela `ManageRemindersWindow` aberta ou fechada,
- **Quando** `manageRemindersWindow.notifyRemindersChanged()` é invocado após a exclusão automática de um one-shot,
- **Então** a janela ativa recebe o evento IPC `reminders-changed` para atualizar a lista exibida (e nada ocorre se a janela for nula ou destruída).

## Fora de escopo

- Criar uma janela Electron separada apenas para lembretes rápidos.
- Adicionar configuração separada de caminho de som padrão fora da convenção `sounds/default-{type}-{N}.mp3`.
- Cancelar outros lembretes rápidos simultâneos quando apenas um for marcado como `Done`.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-002 | Usuários que desejarem áudio padrão devem adicionar arquivos `default-alert-{N}.mp3` (e opcionalmente `default-done-{N}.mp3` / `default-snooze-{N}.mp3`) na pasta `sounds/`; na ausência deles, o disparo visual funciona silenciosamente sem erro. | confirmada | Confirmado pela arquitetura existente de `AudioPlayer.pickRandom` (`null` quando não há `.mp3` correspondente). |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-006 | Como o usuário deve abrir e preencher um Quick One-Shot Reminder? | respondida | Visualização dedicada `Quick Reminder` em `ManageRemindersWindow` (Tray + botão `⚡ Quick Reminder`), gerando ID automático e sem campos de Cron (`/grill-me`). |
| Q-007 | Como o som padrão para one-shot deve funcionar? | respondida | Prefixo `sounds/default` (`sounds/default-{type}-{N}.mp3`) para one-shots e como fallback geral de lembretes, com checkbox `Use default sound` (marcada por padrão) ao criar/editar (`/grill-me`). |
| Q-008 | Como o usuário escolhe quando o Quick One-Shot Reminder dispara? | respondida | Chips rápidos (`5m`, `10m`, `15m`, `30m`, `1h`), campo em minutos (default `15m`) e modo opcional `At HH:MM` (`/grill-me`). |
| Q-009 | Como funciona persistência, Snooze e exclusão em Done no ciclo de vida one-shot? | respondida | Persiste em `config.json` (badge `⚡ One-shot` na lista), permite Snooze/auto-snooze e exclui de `config.json` e `state.json` ao marcar `Done` (`/grill-me`). |
| Q-010 | Como exibir opções extras (Color, Snooze, Auto-dismiss, Block When Focused) no formulário Quick Reminder? | respondida | Formulário enxuto por padrão com seção colapsável `Advanced Options` para sobrescrever essas opções (`/grill-me`). |
| Q-011 | Há limite para lembretes rápidos simultâneos e autorização sobre os domínios compartilhados? | respondida | Usuário pode ter quantos quick reminders simultâneos quiser; aprovado prosseguir (`prosseguir`) estendendo sequencialmente os domínios compartilhados (`ask_question` em 2026-11-17). |

## Documentos relacionados

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)
