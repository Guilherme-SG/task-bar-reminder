# Plano de execução: configure-defaults-panel

Harness: **antigravity** · modo: **sequencial** · execução: task-bar-reminder-configure-defaults-panel-mwl21z03-e8b63162

Use o plano/tarefas, perguntas, agentes, timers e notificações NATIVOS disponíveis nesta sessão.
Confirme a seleção de tarefas e o custo quando ainda não autorizados. Modelos são resolvidos no catálogo atual do harness; nenhum nome é presumido.

| faixa | tarefa | modelo solicitado | esforço | arquivos |
|---|---|---|---|---|
| sequencial | T-001 — Implementar leitura, validação, salvamento, reset e normalização de herança no ConfigLoader | padrão disponível do harness | medium | src/core/ConfigLoader.js, tests/core/ConfigLoader.test.js |
| sequencial | T-002 — Implementar atualização ao vivo de configurações nos serviços principais e janela de popup | padrão disponível do harness | medium | src/core/AudioPlayer.js, src/ui/ReminderWindow.js, src/core/ReminderService.js, tests/core/AudioPlayer.test.js, tests/ui/ReminderWindow.test.js, tests/core/ReminderService.test.js |
| sequencial | T-003 — Adicionar entrada Settings no menu da bandeja (AppTray) | padrão disponível do harness | medium | src/ui/Tray.js, tests/ui/Tray.test.js |
| sequencial | T-004 — Expor canais IPC de configurações e seleção de ffplay em ManageRemindersWindow | padrão disponível do harness | medium | src/ui/ManageRemindersWindow.js, tests/ui/ManageRemindersWindow.test.js |
| sequencial | T-005 — Implementar visualização Settings e herança de defaults na UI e integrar wiring no main.js | padrão disponível do harness | medium | src/ui/manage-reminders.html, src/main.js |

## Execução

`node .spec/features/configure-defaults-panel/executar-tarefas.mjs`

Opções: --listar, --faixa <id>, --seq <T-xxx>, --gate. Retomadas preservam commits, alterações parciais e sessões registradas.
Cada faixa usa worktree e branch próprios; merge é serial e preserva conflitos para revisão. Tarefas só concluem com commit, árvore limpa e gate verificável.
Antes de implementar, revise o impacto em PRDs, ADRs e domínios anteriores. Conflitos pendentes bloqueiam a execução até resposta explícita do cliente.
A 5% ou menos restantes, o executor aguarda o reset e consulta a cota novamente. Sem telemetria inicial, exige uma ponte nativa antes de iniciar; após bloqueio, preserva a espera até leitura fresca. Nunca inventa um saldo.
Progresso sai como eventos no terminal/ledger para o harness nativo. Notificações dependem da preferência do usuário e da capacidade disponível.

## Encerramento

Rode `onp-spec verify configure-defaults-panel` e `onp-spec audit --ci`.
Pergunte com a ferramenta nativa se o usuário quer limpar os worktrees usados. Liste com `onp-spec worktrees configure-defaults-panel`; remova somente após resposta afirmativa, com `--limpar --confirmar`.
Worktrees sujos, ativos ou não integrados são preservados. Não apague branches automaticamente.
