<!-- onp-spec:documentation-contract=v1 -->

# PRD: configure defaults panel

> feature: configure-defaults-panel
> status: revisado

[ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Pedido original do cliente

> /grill-me Now, lets add a new feature, a configure painel that let the user configure the default settings and return then to default. Everything in config.json that comes as default, now will be configurable.

## Problema, público e contexto

Usuários do Desktop Reminder (Electron em Windows) hoje conseguem adicionar, editar e excluir lembretes pela janela `ManageRemindersWindow`, mas todas as configurações globais padrão de `config.json` (`ffplayPath`, `autoSnoozeTimeout`, `snoozeInterval`, `blockWhenFocused`, `window.width`, `window.height` e `window.defaultColor`) exigem edição manual do arquivo JSON em disco e reinicialização do aplicativo.

Pedido recebido em 2026-11-17 via sessão `/grill-me`. A equipe interpretou e estruturou o escopo com o cliente para cobrir:
- Painel visual integrado ao `ManageRemindersWindow` (modo `'settings'`) acessível tanto pelo menu da bandeja (`Settings`) quanto pelo botão `⚙️ Settings` no cabeçalho.
- Configuração e validação de todos os campos padrão de `ConfigLoader.DEFAULTS` com preservação dos lembretes salvos.
- Reversão tanto por campo individual no formulário quanto restauração completa imediata ("Restore All Defaults").
- Aplicação imediata em tempo de execução (live reload) sem reinicializar o app.
- Ajuste no formulário de lembretes para que lembretes possam herdar `window.defaultColor` e `blockWhenFocused` globais em vez de sobrescrevê-los silenciosamente.

## Resultados desejados e métricas

- **Resultado para o cliente:** 100% dos campos globais padrão definidos em `ConfigLoader` tornam-se configuráveis e reversíveis na interface gráfica, com efeito imediato no app em execução.
- **Linha de base observada:** 0 de 7 campos globais padrão possuem interface gráfica; mudanças em `config.json` requerem edição manual de arquivo e reinício.
- **Meta:** 7 de 7 campos globais configuráveis via UI + IPC, restauração por campo e global funcionando sem alterar `reminders`, e 100% de cobertura de testes (statements, branches, functions, lines) exigida pelo `jest.config.js`.
- **Fonte de verificação:** suíte Jest (`yarn test`) e auditoria `onp-spec verify` / `onp-spec audit --ci`.

## Requisitos e prioridades

| Requisito | Palavras do cliente / origem | Prioridade | Critérios na spec |
|---|---|---|---|
| Ler configurações globais e expor valores padrão de fábrica | "Everything in config.json that comes as default, now will be configurable" | Alta | AC-001 |
| Validar e persistir configurações globais preservando `reminders` | "let the user configure the default settings" + validação mínima acordada no `/grill-me` | Alta | AC-002 |
| Restaurar padrões de fábrica por campo e globalmente sem afetar lembretes | "and return then to default" + decisão no `/grill-me` | Alta | AC-003, AC-005 |
| Acessar painel de configurações pelo Tray e cabeçalho do `ManageRemindersWindow` | "a configure painel" + decisão no `/grill-me` | Alta | AC-004 |
| Gerenciar IPC de leitura, salvamento, restauração e seleção de `ffplay.exe` | Decisão de UI integrada + picker de arquivo no `/grill-me` | Alta | AC-005 |
| Aplicar alterações imediatamente em execução (timers/defaults, áudio, FocusGuard, ReminderWindow) | Decisão de live reload no `/grill-me` | Alta | AC-006 |
| Permitir que lembretes herdem cor padrão e lista global de bloqueio | Decisão de alinhamento do formulário de lembretes no `/grill-me` | Média | AC-007 |

## Escopo e exclusões

**No escopo:**
- Leitura, validação, persistência e reset das configurações padrão em `config.json`: `ffplayPath`, `autoSnoozeTimeout`, `snoozeInterval`, `blockWhenFocused`, `window.width`, `window.height`, `window.defaultColor`.
- Modo `'settings'` em `ManageRemindersWindow` (`src/ui/ManageRemindersWindow.js` e `src/ui/manage-reminders.html`), item `Settings` no menu `AppTray` (`src/ui/Tray.js`), integração no `src/main.js`.
- Atualização ao vivo em `AudioPlayer`, `ReminderWindow` e `ReminderService` (incluindo `FocusGuard` e liberação de pendentes).
- Suporte no formulário de lembrete para herdar cor padrão (`color: null` -> remove propriedade) e modo de bloqueio (`inherit` / `custom` / `none`), além de placeholders dinâmicos com os valores globais atuais.

**Exclusões explícitas:**
- Não cria janela `BrowserWindow` separada para Settings.
- Não altera ou apaga lembretes cadastrados ao salvar ou restaurar padrões globais.
- Não exige que `ffplayPath` exista no disco ao salvar (permite caminho vazio ou personalizado digitado/selecionado).
- Não altera `config.example.json` nem cria novos scripts/painéis HTML paralelos ao fluxo nativo.

## Regras de produto e domínios

- **Domínios afetados:** `config` (`ConfigLoader`), `core` (`AudioPlayer`, `ReminderService`), `ui` (`ManageRemindersWindow`, `manage-reminders.html`, `ReminderWindow`), `tray` (`Tray`).
- **Invariantes preservados:**
  - Tempos em `config.json` permanecem em **segundos**; `ConfigLoader.load()` e o retorno runtime de `saveSettings`/`resetSettings` convertem para **milissegundos** (`SECONDS_TO_MS`).
  - `ConfigLoader.getSettings()` retorna valores em **segundos** (mesma unidade do JSON e dos inputs da UI) junto com `defaults` de fábrica em segundos.
  - `window.width >= 200`, `window.height >= 120`, `window.defaultColor` em hex `#RRGGBB`, `snoozeInterval >= 0`, `autoSnoozeTimeout >= 0`, `ffplayPath` string, `blockWhenFocused` array de strings não vazias.
  - `jest.config.js` exige 100% de cobertura global; `onpspec.config.json` mapeia todos os arquivos de `src/` tocados.

## Dependências, riscos e suposições

- **Dependência:** `Electron` (`BrowserWindow`, `ipcMain`, `dialog`, `Tray`, `Menu`) e `FocusGuard` / `ProcessList` para seleção de apps no Windows.
- **Risco:** sobrescrever `reminders` no `config.json` ao salvar configurações globais. Mitigado preservando `raw.reminders || []` dentro de `ConfigLoader.saveSettings()`.
- **Risco:** formulário de lembrete forçar `color` e `blockWhenFocused: []` impedindo herança dos novos defaults globais. Mitigado com controles explícitos de herança no `#formView` e normalização em `#normalizeReminder`.
- **Suposição vinculada:** ver [Spec](spec.md#suposições) (`ASM-001`).

## Validação com o cliente

Todas as decisões de produto foram validadas em entrevista `/grill-me` com o cliente em 2026-11-17:

1. **Local e abertura do painel (Q-001):** Integrado em `ManageRemindersWindow` como visualização `'settings'`, acessível pelo item `Settings` no Tray e botão `⚙️ Settings` no cabeçalho.
2. **Comportamento de retorno ao padrão (Q-002):** Ambos — botão `Restore All Defaults` (com confirmação, salva e aplica imediatamente os padrões de fábrica) e botões de reset por campo no formulário, sem tocar nos lembretes salvos.
3. **Alinhamento do formulário de lembretes (Q-003):** Atualizar o formulário Add/Edit Reminder para permitir herdar `window.defaultColor` e `blockWhenFocused` globais e mostrar os defaults globais nos placeholders de `Snooze` e `Auto-dismiss`.
4. **Aplicação de mudanças em execução (Q-004):** Aplicar todas as alterações ao vivo imediatamente ao salvar/restaurar (timers/defaults, `ffplayPath`, `FocusGuard`, redimensionamento/reposicionamento de `ReminderWindow`) sem reiniciar o app.
5. **Regras de validação de `window` e `ffplayPath` (Q-005):** Exigir mínimos sensatos (`width >= 200`, `height >= 120`) e aceitar qualquer string em `ffplayPath` (com botão de seleção de arquivo `.exe` na UI).
6. **Fluxo de execução:** Seguir especificação completa `onp-spec-driven` e implementação sequencial no workspace.
