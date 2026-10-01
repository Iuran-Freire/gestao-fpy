# Guia do projeto FPY

Abra a pasta **Gestão do FPY** no VS Code. O projeto é a pasta inteira; nenhum arquivo isolado contém o sistema completo.

## Mapa das pastas

```text
app/                              Entradas das páginas e rotas HTTP
  api/                            Endereços /api usados pela interface
  page.tsx                        Abre o sistema
  layout.tsx                      Estrutura HTML, ícones e metadados
  globals.css                     Importa os estilos na ordem correta
src/
  frontend/
    presentation/                 Telas, separadas por módulo
      shell/fpy-workspace.tsx     Navegação e composição da aplicação
      fpy/                        Consulta, filtros e lançamento
      analytics/                  Painel de indicadores e gráficos
      auth/                       Login e perfil
      management/                 Cadastros e usuários
      action-plans/               Fluxo de planos de ação
      legacy/                     Tela antiga de PQC, fora da navegação atual
    application/                  Estado e operações no navegador
      analytics/metrics.ts       Funções e constantes dos indicadores
      use-fpy.ts                 Sessão, carregamento e sincronização
      fpy-filters.ts             Regras dos filtros por data
      csv.ts                     Exportação
    components/
      forms/                     Controles de formulário compartilhados
      ui/                        Componentes básicos do design system
    infrastructure/offline.ts    API HTTP e armazenamento IndexedDB
    styles/                      Estilos compartilhados, login e biblioteca visual
    hooks/                       Hooks reutilizáveis
    lib/                         Utilitários de interface
  backend/
    application/                 Regras e operações do servidor
    auth/                        Integração de identidade
    infrastructure/              Banco e proteção de senhas
    database/                    Esquema e migrações versionadas
  shared/domain/                 Tipos, validações e cálculo do FPY
public/                           Logo, ícones, manifesto e service worker
tests/
  unit/                          Testes automáticos sem servidor externo
  integration/                   Testes contra o servidor e banco locais
scripts/                          Ferramentas de execução e manutenção
docs/                             Documentação de desenvolvimento
```

## Onde fazer cada alteração

| Alteração | Local |
| --- | --- |
| Menu, navegação e composição das abas | `src/frontend/presentation/shell/fpy-workspace.tsx` |
| Formulário de produção ou defeitos | `src/frontend/presentation/fpy/entry-form.tsx` |
| Campos dos filtros | `src/frontend/presentation/fpy/fpy-filters.tsx` |
| Indicadores e filtros do dashboard | `src/frontend/presentation/analytics/analytics-dashboard.tsx` |
| Desenho dos gráficos | `src/frontend/presentation/analytics/charts.tsx` |
| Agrupamento e formatação dos indicadores | `src/frontend/application/analytics/metrics.ts` |
| Login e perfil | `src/frontend/presentation/auth/` |
| Cadastros e usuários | `src/frontend/presentation/management/` |
| Plano de ação atual | `src/frontend/presentation/action-plans/` |
| Aparência compartilhada das telas | `src/frontend/styles/global.css` |
| Aparência de login e perfil | `src/frontend/styles/auth.css` |
| Fórmula, tipos e validações do FPY | `src/shared/domain/fpy.ts` |
| Acesso, permissões e gravação | `src/backend/application/` |
| Alterações no esquema do banco | Nova migração em `src/backend/database/migrations/` |

O componente `Choice` fica em `components/forms` porque é usado tanto nos lançamentos quanto nos cadastros de usuários.
O módulo `presentation/legacy` preserva a tela anterior de PQC. O fluxo atual usa `action-plans` e o domínio `shared/domain/action-plan.ts`.

## Limites entre as camadas

O navegador importa regras de `shared` e acessa o servidor pelas rotas `/api`.
O servidor importa regras de `shared` e acessa o banco pela infraestrutura.
As regras compartilhadas não dependem de telas ou banco. O ESLint verifica essas fronteiras.

`app/api` permanece nesse caminho porque o framework encontra as rotas por essa estrutura.
As configurações de build, dependências e hospedagem permanecem na raiz pelos mesmos motivos.

## Arquivos gerados

O Explorer do VS Code oculta `.next`, `.vinext`, `.wrangler`, `.sites-runtime`, `dist`, `out`, `coverage`, `node_modules`, `next-env.d.ts` e `*.tsbuildinfo`.
Eles continuam no disco; ocultar não apaga arquivos nem dados.
Em particular, `.wrangler` pode conter o banco local.
As regras de visualização ficam em `.vscode/settings.json`.

## Comandos

- `npm run dev`: inicia o sistema local em localhost:5173.
- `npm test`: executa os testes de regras, filtros, CSV e esquema em memória.
- `npm run typecheck`: verifica os tipos e caminhos de importação.
- `npm run lint`: verifica o código e as fronteiras entre camadas.
- `npm run build`: gera a compilação local.

Os scripts em `tests/integration` precisam do servidor e banco locais preparados; alguns criam registros fictícios.
Execute-os a partir da raiz do projeto. Eles não fazem parte de `npm test`.

Publicação na Cloudflare e envio ao GitHub dependem de pedido explícito do responsável.
