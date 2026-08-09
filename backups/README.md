# Backups para desenvolvimento

Esta pasta guarda cópias dos dados necessárias para continuar o desenvolvimento em outro computador.

- `local-dev/mes-engates.sqlite`: cópia consistente do banco SQLite usado nos testes locais.
- `local-dev/r2-state/`: cópia dos arquivos locais do armazenamento de imagens.
- `prisma/dev.db`: banco SQLite legado do projeto, mantido porque algumas ferramentas de desenvolvimento ainda o utilizam.

## Em outro computador

1. Clone o repositório e instale as dependências com `npm install`.
2. Execute `npm run dev`. As migrações em `drizzle/` criam o banco local do Sites.
3. Para recuperar exatamente o estado local anterior, copie o conteúdo de `backups/local-dev/r2-state/` para `.wrangler/state/v3/r2/` e use `backups/local-dev/mes-engates.sqlite` como referência do banco.
4. O banco online permanece preservado no serviço Sites e não está exposto neste repositório público.

O repositório é público e contém dados de teste. Troque as senhas antes de utilizar o sistema em produção real.
