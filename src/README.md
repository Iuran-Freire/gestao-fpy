# Arquitetura

Consulte o [guia completo das pastas e arquivos](../docs/ESTRUTURA.md).

O código da aplicação é dividido por ambiente de execução:

- `frontend/`: executa no navegador. Contém telas, hooks, IndexedDB, sincronização HTTP e exportação de arquivos.
- `backend/`: executa no servidor. Contém autenticação, permissões, casos de uso e acesso ao Cloudflare D1/R2.
- `shared/`: código independente de ambiente. Contém tipos, validações e cálculos usados nos dois lados.

## Dependências permitidas

```text
frontend ──► shared
backend  ──► shared
app/api  ──► backend ──► shared
app/page ──► frontend ──► shared
```

O frontend acessa o backend somente por `/api`. O backend não importa componentes ou armazenamento do navegador. O código em `shared` não importa módulos de frontend ou backend. O ESLint verifica essas fronteiras.

As pastas `app/` e `public/` permanecem na raiz porque são pontos de entrada exigidos pelo Next.js. O esquema e as migrações ficam em `backend/database/`, conforme os caminhos definidos no `drizzle.config.ts`.

As telas de `frontend/presentation` são agrupadas em `shell`, `fpy`, `analytics`, `auth`, `management` e `action-plans`.
O componente principal é `shell/fpy-workspace.tsx`; os indicadores são um módulo separado em `analytics`.
Os estilos ficam em `frontend/styles`, os componentes compartilhados em `frontend/components` e as funções dos indicadores em `frontend/application/analytics`.
