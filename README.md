# Gestão de FPY — Inventus Power

Sistema PWA de produção e defeitos, com consulta anual e fila offline. A implantação inicial é privada.

## Organização do código

- `src/domain/fpy.ts`: entidades, validação, chave de produção, semana ISO e FPY ponderado. Sem dependência de interface ou banco.
- `src/application/`: casos de uso, permissões, sincronização e backup.
- `src/infrastructure/`: acesso ao D1/R2, IndexedDB e transporte HTTP.
- `src/presentation/`: consulta, formulários e componentes de interação.
- `app/api/`: adaptadores HTTP que autenticam e chamam a aplicação.
- `db/schema.ts` e `drizzle/`: estrutura e migrações versionadas, incluindo auditoria e proteção de revisão.
- `public/`: logo oficial, ícones e recursos PWA.
- `tests/`: regras de domínio e integração local.

## Regras implementadas

Um total de produção por data + turno + linha + PN, garantido por índice único no banco. Defeitos são lançamentos independentes e cumulativos. Código e posição são obrigatórios. Reprovações correspondem à primeira passagem, uma única ocorrência por peça. FPY não é calculado quando falta produção, quando o total é zero ou quando defeitos excedem produção. Consolidado ponderado pelas quantidades, sem média simples de percentuais.

Operadores lançam. Supervisor, líder e técnica corrigem. Toda correção exige motivo, compara revisão e preserva histórico no servidor. Um conflito de correção exige nova leitura; nunca sobrescreve silenciosamente uma versão mais recente.

Semana ISO (segunda a domingo) derivada da data. Na virada do ano, o ano ISO pode diferir do ano civil; a consulta anual usa a data civil. Não há fechamento de turno.

## Acesso

O FPY aceita usuário ou e-mail e senha. Gestão permite criar, editar, redefinir senha e desativar/reativar contas preservando o histórico. O administrador principal atribui níveis; líderes, supervisores e técnicas gerenciam operadores. A própria conta principal não pode ser desativada. Cada alteração mantém auditoria.

A publicação continua privada no Sites (ChatGPT): cadastrar alguém no FPY não libera essa barreira externa. O primeiro responsável mantém recuperação pela identidade original do Sites. Para configurar suas credenciais, define o usuário em Meu perfil e depois acessa Minha senha. Outras contas recebem senha temporária com troca obrigatória no primeiro acesso.

Senhas não vazias aceitam livremente tamanho e combinação de caracteres, sem exigir letras, números ou símbolos. Um limite técnico amplo de 4.096 caracteres protege o serviço contra entradas abusivas. As senhas usam scrypt com salt aleatório (N=16384, r=8, p=5). Cookies HttpOnly/SameSite=Strict têm validade de 12 horas, Secure em HTTPS. Apenas o hash do token fica no banco; alterações de cadastro e senha invalidam sessões. Login tem limites por identificador e IP. Senhas não são armazenadas em texto puro nem no cache offline.

A prévia local simula uma conta, conforme o starter. Essa simulação não é incluída no build publicado. Não implementar autenticação confiando em cabeçalhos do cliente em outra hospedagem sem um proxy de identidade confiável.

## Offline

O primeiro acesso, login e download anual exigem conexão. IndexedDB guarda a cópia anual de todos os modelos e a fila vinculada ao usuário. Envios têm UUID para idempotência. A fila é enviada ao reconectar, ao abrir, manualmente ou a cada dois minutos enquanto aberto. Não depende de sincronização em segundo plano do sistema operacional. Erros de validação/conflitos ficam em Sincronização; envios recusados podem ser descartados para novo lançamento. Não existe remoção de registros confirmados.

O PWA solicita persistência do armazenamento, mas o navegador pode negar. Não limpar os dados do navegador com envios pendentes. Sair limpa a cópia local e é bloqueado enquanto há pendências. Apenas a última conta autenticada pode trabalhar offline. Alterações de permissão são revalidadas no servidor no envio.

Service worker ativo no build de produção: shell e recursos estáticos em cache; respostas da API nunca são armazenadas pelo service worker. Dados anuais são armazenados separadamente no IndexedDB. Sem dados importados, o histórico começa vazio.

## Backup — limitação de implantação

Backup manual em Gestão implementado no R2: páginas de 500 registros, manifesto de conclusão, retenção de 12 meses e rejeição da cópia se houver novos lançamentos ou alterações de usuários durante a geração. Os dados de negócio não expiram. Inclui hashes protegidos de senhas, cadastros e auditoria; exclui sessões e tentativas de login. O arquivo deve permanecer restrito ao administrador.

**O agendamento diário independente de acesso ainda não foi ativado.** A hospedagem Sites disponível não expõe configuração de cron nas ferramentas desta sessão. Não considerar o requisito de backup diário concluído até configurar um agendador suportado com autenticação de serviço e testar restauração. A API atual de backup requer o usuário responsável autenticado; não expor essa rota publicamente para um agendador.

O manifesto lista todos os objetos JSON de um backup completo. Para restauração em ambiente isolado, importar registros por tabela preservando IDs e revisões, retirar `_rowid`, e validar contagens antes de substituir a base. Uma interface de restauração não foi criada. A retenção é aplicada quando um backup é gerado.

## Desenvolvimento e verificação

- `npm ci`: instalar dependências.
- `npm run dev`: prévia em localhost:5173.
- `npm run build`: build de produção.
- `node --test tests/fpy.test.mjs`: regras de cálculo e validação.
- `node tests/api-local.mjs`: integração contra prévia local; cria somente registros fictícios identificados como QA.
- `node tests/users-local.mjs`: contas fictícias, login, permissões, edição, desativação, redefinição e revogação de sessões.
- `npx tsc --noEmit`: verificação TypeScript.

Para banco local, aplicar as migrações de `drizzle/` em ordem com Wrangler usando `dist/server/wrangler.json` e `.wrangler/state`. Não repetir migrações aplicadas. O banco local e os registros QA não são publicados.

## Pendências externas

- Receber arquivos anuais para mapear e importar histórico.
- Autorizar os usuários da equipe na publicação privada e definir seus perfis.
- Ativar agendamento diário de backup e homologar restauração.
- Homologar instalação e armazenamento anual no aparelho real utilizado na linha.

Logo obtido de https://inventuspower.com/wp-content/uploads/inventus-power-logo.svg. Sem agente de IA nesta versão, conforme planejamento.

## Evidências de verificação desta versão

- Testes de domínio: cálculo ponderado, ausência de produção, produção zero, quantidades inválidas, normalização da chave e semana ISO.
- Integração local: criação, reenvio idempotente, bloqueio de produção duplicada, correção com revisão, conflito, autoria do servidor e auditoria.
- Permissões: API recusou correção por operador (403) e o perfil fictício foi restaurado.
- Backup local: criação em R2, download NDJSON e restauração em SQLite isolado confirmados.
- Browser: formulário com dois defeitos somou 5 peças e mostrou FPY de 95% para produção de 100.
- PWA compilado: com servidor desligado, a tela e os registros abriram novamente; novo defeito foi salvo e permaneceu após recarregar.
- Layout verificado em largura de 390 pixels, sem rolagem horizontal da página. Tabelas têm rolagem própria.

Os testes usam dados fictícios somente no banco local. O conjunto anual real ainda não foi recebido; desempenho e capacidade de armazenamento devem ser homologados com esse volume e no dispositivo da fábrica.
