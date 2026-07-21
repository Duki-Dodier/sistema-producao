# MES Engates

Sistema de acompanhamento da produção de engates.

## Desenvolvimento local

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

Na primeira execução, crie o banco local e os dados de demonstração:

```bash
npm run db:migrate
npm run db:seed
```

## Publicar na nuvem

O projeto está preparado para rodar como um container Docker, com volumes
persistentes para o banco SQLite e para as imagens enviadas pelos usuários.
Isso é necessário: plataformas com sistema de arquivos efêmero (por exemplo,
um deploy serverless sem volume) perderiam os apontamentos e uploads após uma
nova publicação.

1. Crie um serviço Docker em um provedor que ofereça **disco persistente**
   (por exemplo, Render, Railway, Fly.io, uma VM ou Kubernetes) e conecte este
   repositório.
2. Use o `Dockerfile` da raiz. O container expõe a porta `3000`; configure o
   provedor para encaminhar o tráfego para ela.
3. Monte dois volumes persistentes, sem compartilhar entre ambientes:
   * `/data` para o arquivo do banco;
   * `/app/public/uploads` para as imagens cadastradas.
4. Configure as variáveis de ambiente:

   ```text
   DATABASE_URL=file:/data/mes-engates.db
   SEED_DATABASE=true
   ```

   `SEED_DATABASE` só cria os dados de demonstração quando o banco ainda não
   existe. Para iniciar uma operação vazia, defina-a como `false` antes do
   primeiro deploy.
5. Faça o deploy. A URL pública fornecida pelo provedor é o link que pode ser
   compartilhado com a equipe.

Para validar a mesma configuração antes de publicar, execute:

```bash
docker compose up --build
```

Depois, acesse `http://localhost:3000`. Os volumes nomeados no
`docker-compose.yml` mantêm os dados mesmo que o container seja recriado.

> **Backup:** copie regularmente o arquivo `mes-engates.db` do volume `/data`
> e o conteúdo do volume de uploads. Não remova esses volumes ao atualizar o
> serviço.
