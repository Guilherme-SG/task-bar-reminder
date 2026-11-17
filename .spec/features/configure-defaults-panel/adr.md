<!-- onp-spec:documentation-contract=v1 -->

# ADR: configure defaults panel

> feature: configure-defaults-panel
> status: revisado

[PRD](prd.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Identificação e contexto

- **Decisão:** Arquitetura do painel de configurações padrão, persistência em `config.json`, atualização em tempo de execução e herança no formulário de lembretes.
- **Responsáveis:** Equipe / Sessão Antigravity + Dono do Produto (via `/grill-me`).
- **Data:** 2026-11-17.
- **Domínios:** `config`, `core`, `ui`, `tray`.
- **Requisitos atendidos:** `US-001` a `US-005` (`AC-001` a `AC-007`) definidos em [Spec](spec.md) e [PRD](prd.md).

## Restrições e regras anteriores

- **Constituição do projeto:** `P-001` (todo requisito tem prova executável e `audit --ci` limpo) e `P-002` (sem segredos em código).
- **Convenções em `AGENTS.md`:**
  - `config.json` armazena durações em segundos; `ConfigLoader` converte para ms para uso em runtime (`SECONDS_TO_MS`).
  - `ReminderWindow` utiliza `window.show()` e `nodeIntegration: true` / `contextIsolation: false` com `escapeHtml()`.
  - `jest.config.js` impõe 100% de cobertura global (branches, functions, lines, statements) em `src/core/**/*.js` e `src/ui/**/*.js`.
- **Contratos anteriores mantidos:** Todos os métodos existentes de `ConfigLoader`, `ReminderService`, `ReminderWindow`, `AudioPlayer`, `ManageRemindersWindow` e `AppTray` mantêm compatibilidade retroativa com os 301 testes existentes.

## Alternativas consideradas

1. **Nova janela `SettingsWindow` separada vs. nova visualização (`mode = 'settings'`) dentro de `ManageRemindersWindow`:**
   - *Benefício da visualização integrada:* Reaproveita o seletor de processos (`ProcessList`), estilo visual escuro, ciclo de vida de ocultação/fechamento, e permite compartilhar estado de defaults com o formulário Add/Edit Reminder sem sincronização entre múltiplas janelas.
   - *Custo da janela separada:* Duplicação de HTML/CSS, gerenciamento extra de `BrowserWindow` e handlers IPC de lista de processos.
2. **Reinício obrigatório do app vs. atualização ao vivo (`updateSettings`) em runtime:**
   - *Benefício do live reload:* Resposta instantânea para cor padrão, dimensões da janela de popup, `ffplayPath`, intervalos padrão e lista global `blockWhenFocused` (incluindo start/stop do `FocusGuard` e liberação de lembretes adiados).
   - *Custo do reinício:* Interrompe a experiência e timers em andamento.
3. **Validação estrita de existência em disco para `ffplayPath` vs. validação de tipo string:**
   - *Benefício da string livre:* Permite apagar o caminho para silenciar áudio ou configurar antes de instalar/copiar o executável, mantendo um botão de seleção `.exe` para conveniência.

## Decisão e justificativa

1. **Painel integrado em `ManageRemindersWindow` (`mode = 'settings'`)** acionado via botão `⚙️ Settings` no cabeçalho e item `Settings` no menu de `AppTray`.
2. **API dedicada em `ConfigLoader` (`getDefaults`, `validateSettings`, `getSettings`, `saveSettings`, `resetSettings`)**:
   - Separa unidade de configuração/UI (segundos) da unidade de runtime (milissegundos) retornada por `saveSettings` / `resetSettings` para `ReminderService.updateSettings`.
   - Impõe mínimos `window.width >= 200` e `window.height >= 120` tanto em `load()` quanto em `saveSettings()` via `validateSettings()`.
   - Estende `#normalizeReminder` para aceitar `color: null` e `blockWhenFocused: null` como remoção de sobrescrita por lembrete (habilitando herança dos defaults globais).
3. **Live reload via `ReminderService.updateSettings(runtimeSettings)`**, `AudioPlayer.setFfplayPath(path)` e `ReminderWindow.updateConfig(config)`.

## Consequências e riscos

- **Positivas:** Experiência unificada, reversibilidade por campo e global sem perda de lembretes, e 100% de testabilidade unitária nos módulos JS sem depender de Electron real.
- **Negativas / Riscos:** `ReminderWindow.updateConfig` reposiciona apenas se a janela já existir e não estiver destruída (cards já renderizados mantêm sua cor aplicada no momento da exibição; novos popups e redimensionamento usam imediatamente a nova config). Detalhes de risco e mitigação constam no [TDD](design.md#6-riscos-e-mitigação).

## Validade, revisão e substituição

- Esta decisão permanece válida enquanto a arquitetura Electron multi-view em `ManageRemindersWindow` e persistência em `config.json` forem adotadas.
- Qualquer migração futura para TypeScript, framework frontend ou armazenamento separado de preferências exigirá nova ADR vinculada que substitua esta.

## Respostas e aprovação

- Todas as decisões arquiteturais (local da UI, reset por campo/global, alinhamento de herança nos lembretes, live reload e validação de dimensões/`ffplayPath`) foram confirmadas pelo cliente durante a entrevista `/grill-me` em 2026-11-17 (ver [PRD](prd.md#validação-com-o-cliente) e [Spec](spec.md#perguntas-em-aberto)).
