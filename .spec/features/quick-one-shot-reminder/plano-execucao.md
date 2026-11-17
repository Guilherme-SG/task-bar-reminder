# Plano de execução: quick-one-shot-reminder

Harness: **antigravity** · modo: **sequencial** · execução: task-bar-reminder-quick-one-shot-reminder-mwl4g7s2-ecf331b6

Use o plano/tarefas, perguntas, agentes, timers e notificações NATIVOS disponíveis nesta sessão.
Confirme a seleção de tarefas e o custo quando ainda não autorizados. Modelos são resolvidos no catálogo atual do harness; nenhum nome é presumido.

| faixa | tarefa | modelo solicitado | esforço | arquivos |
|---|---|---|---|---|
| sequencial | T-006 — Implementar geração de ID, validação e normalização de lembretes one-shot e useDefaultSound no ConfigLoader | padrão disponível do harness | medium | src/core/ConfigLoader.js, tests/core/ConfigLoader.test.js |
| sequencial | T-007 — Implementar fallback para sounds/default-{type}-{N}.mp3 no AudioPlayer | padrão disponível do harness | medium | src/core/AudioPlayer.js, tests/core/AudioPlayer.test.js |
| sequencial | T-008 — Implementar ciclo de vida one-shot, seleção de som padrão e limpeza automática em Done no ReminderService | padrão disponível do harness | medium | src/core/ReminderService.js, tests/core/ReminderService.test.js |
| sequencial | T-009 — Adicionar atalho Quick one-shot reminder no Tray e notificação reminders-changed em ManageRemindersWindow | padrão disponível do harness | medium | src/ui/Tray.js, src/ui/ManageRemindersWindow.js, tests/ui/Tray.test.js, tests/ui/ManageRemindersWindow.test.js |
| sequencial | T-010 — Construir view Quick Reminder, checkbox Use default sound e wiring no main.js | padrão disponível do harness | medium | src/ui/manage-reminders.html, src/main.js |

## Execução

`node .spec/features/quick-one-shot-reminder/executar-tarefas.mjs`

Opções: --listar, --faixa <id>, --seq <T-xxx>, --gate. Retomadas preservam commits, alterações parciais e sessões registradas.
Cada faixa usa worktree e branch próprios; merge é serial e preserva conflitos para revisão. Tarefas só concluem com commit, árvore limpa e gate verificável.
Antes de implementar, revise o impacto em PRDs, ADRs e domínios anteriores. Conflitos pendentes bloqueiam a execução até resposta explícita do cliente.
A 5% ou menos restantes, o executor aguarda o reset e consulta a cota novamente. Sem telemetria inicial, exige uma ponte nativa antes de iniciar; após bloqueio, preserva a espera até leitura fresca. Nunca inventa um saldo.
Progresso sai como eventos no terminal/ledger para o harness nativo. Notificações dependem da preferência do usuário e da capacidade disponível.

## Encerramento

Rode `onp-spec verify quick-one-shot-reminder` e `onp-spec audit --ci`.
Pergunte com a ferramenta nativa se o usuário quer limpar os worktrees usados. Liste com `onp-spec worktrees quick-one-shot-reminder`; remova somente após resposta afirmativa, com `--limpar --confirmar`.
Worktrees sujos, ativos ou não integrados são preservados. Não apague branches automaticamente.
