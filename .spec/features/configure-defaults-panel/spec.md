<!-- onp-spec:documentation-contract=v1 -->

# Spec: Configure defaults panel

> feature: configure-defaults-panel
> status: auditada

## Contexto

Permite que o usuário visualize, edite, aplique em tempo real e restaure ao padrão de fábrica todas as configurações padrão globais de `config.json` por meio de um painel integrado à interface do aplicativo, além de permitir que lembretes herdem esses padrões globais.

## Histórias

### US-001 — Leitura, validação e persistência das configurações padrão

Como usuário do aplicativo,
quero ler, validar, salvar e restaurar as configurações padrão globais sem perder meus lembretes cadastrados,
para que eu possa ajustar preferências globais com segurança e reversibilidade.

#### AC-001 — Carregar configurações globais e valores padrão de fábrica

- **Dado** um arquivo `config.json` válido com configurações parciais ou personalizadas,
- **Quando** `ConfigLoader.getSettings()` e `ConfigLoader.getDefaults()` são chamados,
- **Então** o sistema retorna os valores efetivos em segundos (com fallback para os padrões de fábrica) acompanhados dos valores originais de fábrica em `defaults`.

#### AC-002 — Validar e salvar configurações globais preservando os lembretes existentes

- **Dado** novas configurações globais válidas ou inválidas (incluindo dimensões mínimas `window.width >= 200` e `window.height >= 120`, cor hex válida e valores não negativos),
- **Quando** `ConfigLoader.saveSettings()` é executado,
- **Então** entradas inválidas lançam erros descritivos sem alterar o arquivo, e entradas válidas são gravadas em `config.json` mantendo `reminders` intactos e retornando os valores runtime em milissegundos.

#### AC-003 — Restaurar configurações globais para o padrão de fábrica

- **Dado** um `config.json` com configurações globais modificadas e lembretes salvos,
- **Quando** `ConfigLoader.resetSettings()` é executado,
- **Então** todos os campos globais voltam aos valores padrão de fábrica em `config.json`, os lembretes existentes permanecem preservados e as configurações runtime restauradas são retornadas.

---

### US-002 — Acesso ao painel de configurações pela bandeja e janela de gerenciamento

Como usuário do aplicativo,
quero abrir o painel de configurações tanto pelo menu da bandeja do sistema quanto pelo cabeçalho da janela de lembretes,
para acessar rapidamente as opções padrão de qualquer ponto da interface.

#### AC-004 — Abrir a visualização de configurações pelo menu da bandeja (Tray) e cabeçalho

- **Dado** o menu da bandeja do sistema e a janela `ManageRemindersWindow`,
- **Quando** o usuário clica no item `Settings` da bandeja ou abre a janela no modo `'settings'`,
- **Então** o callback `onOpenSettings` é disparado e a janela exibe a visualização `'settings'` (`init-view` com `mode: 'settings'`).

---

### US-003 — Edição e restauração de configurações no painel com IPC

Como usuário utilizando o painel de configurações,
quero carregar as configurações atuais, salvar alterações, selecionar o executável `ffplay` e restaurar padrões via interface,
para configurar todas as opções sem editar JSON manualmente.

#### AC-005 — Gerenciar leitura, salvamento, restauração e seleção de executável ffplay via IPC

- **Dado** os canais IPC registrados por `ManageRemindersWindow`,
- **Quando** o renderer invoca `get-settings`, `save-settings`, `reset-settings` ou `browse-ffplay-file`,
- **Então** a janela encaminha os dados para os handlers configurados (retornando erros amigáveis em caso de falha ou ausência de handler) e abre o seletor de arquivo `.exe` para `ffplayPath`.

---

### US-004 — Aplicação imediata em tempo de execução (live reload)

Como usuário que acabou de salvar ou restaurar configurações padrão,
quero que todas as alterações entrem em vigor imediatamente no aplicativo em execução,
para não precisar reiniciar o app para testar ou usar os novos padrões.

#### AC-006 — Aplicar alterações de configurações imediatamente nos serviços ativos sem reiniciar

- **Dado** o aplicativo em execução com `AudioPlayer`, `ReminderWindow`, `FocusGuard` e `ReminderService` ativos,
- **Quando** `ReminderService.updateSettings()` recebe as novas configurações runtime,
- **Então** `ffplayPath` é atualizado no `AudioPlayer`, `ReminderWindow` recebe a nova configuração e se reposiciona/redimensiona se existir, e o `FocusGuard` é iniciado/parado conforme necessário liberando lembretes pendentes elegíveis.

---

### US-005 — Herança dos padrões globais no formulário de lembretes

Como usuário criando ou editando lembretes na interface,
quero poder optar por herdar a cor padrão global e a lista global de aplicativos bloqueados,
para que alterações nas configurações globais reflitam automaticamente nos lembretes que usam o padrão.

#### AC-007 — Permitir que lembretes herdem ou limpem cor e lista de bloqueio global

- **Dado** um lembrete salvo ou atualizado com `color` vazio/`null` ou `blockWhenFocused: null`,
- **Quando** `ConfigLoader.saveReminder()` ou `ConfigLoader.updateReminder()` normaliza e grava o lembrete,
- **Então** os campos `color` e `blockWhenFocused` opcionais limpos são removidos do registro do lembrete para que ele passe a herdar os valores globais padrão.

## Fora de escopo

- Criar uma janela Electron separada apenas para configurações.
- Validar se o caminho informado em `ffplayPath` aponta para um binário existente no disco no momento de salvar.
- Modificar automaticamente lembretes pré-existentes ao restaurar padrões globais.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | `config.json` já existe quando o painel é aberto, pois o app valida seu carregamento na inicialização em `src/main.js` | confirmada | Confirmado em `src/main.js` linhas 20-32 (`ConfigLoader.load()`). |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | Onde o painel de configurações deve ficar e como abri-lo? | respondida | Integrado ao `ManageRemindersWindow` (`mode: 'settings'`), acessível pelo item `Settings` no Tray e botão `⚙️ Settings` no cabeçalho (`/grill-me`). |
| Q-002 | Como deve funcionar o retorno ao padrão ("return to default")? | respondida | Ambos: botão `Restore All Defaults` (confirma, salva e aplica imediatamente os defaults) e botões de reset por campo no formulário, sem tocar nos lembretes (`/grill-me`). |
| Q-003 | O formulário de lembretes deve ser alinhado para herdar os padrões globais de Cor e Bloqueio? | respondida | Sim, permitir herança de cor padrão e `blockWhenFocused` global e exibir os defaults atuais nos placeholders de Snooze/Auto-dismiss (`/grill-me`). |
| Q-004 | Como as mudanças salvas/restauradas devem ser aplicadas no app em execução? | respondida | Aplicar todas as alterações ao vivo imediatamente sem reiniciar (`/grill-me`). |
| Q-005 | Quais regras de validação aplicam-se às dimensões da janela e `ffplayPath`? | respondida | Exigir `window.width >= 200` e `window.height >= 120`, e permitir qualquer string em `ffplayPath` com botão de browse `.exe` (`/grill-me`). |

## Documentos relacionados

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)
