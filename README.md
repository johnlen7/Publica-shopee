# Publica Shopee — Gestor de Vídeos de Listing

Plataforma web para sellers Shopee gerenciarem em escala os **vídeos de listagem de produtos** via Shopee Open Platform (media_space + product API).

> **Escopo revisado após auditoria técnica.** O PRD original propunha automação de posts no feed **Shopee Video** (estilo TikTok). A pesquisa em fontes oficiais e ToS (ver [`AUDIT.md`](./AUDIT.md)) concluiu que **não existe API pública para publicar no feed Shopee Video** e que o ToS da Shopee Live proíbe automação via scripts. O produto foi reposicionado para o caminho 100% oficial e dentro do ToS: **gestão de vídeos de listing de produto**.

> **Status atual:** Fase 0 concluída (scaffold monorepo). Fase 1 em implementação.

---

## Sumário

- [Visão geral](#visão-geral)
- [Princípios do produto](#princípios-do-produto)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Protótipo de UI](#protótipo-de-ui)
- [Arquitetura alvo](#arquitetura-alvo)
- [Escopo MVP](#escopo-mvp)
- [Dependências críticas e riscos](#dependências-críticas-e-riscos)
- [Como executar o protótipo](#como-executar-o-protótipo)
- [Documentação](#documentação)
- [Roadmap](#roadmap)

---

## Visão geral

Sellers que operam em volume enfrentam um processo manual para cadastrar vídeos em cada um de seus produtos na Shopee: envios repetitivos, metadados inconsistentes, ausência de fila/retry, pouca rastreabilidade. Este projeto entrega uma camada operacional sobre a **Shopee Open Platform** (endpoints confirmados na auditoria) para:

- conectar múltiplas contas Shopee via **OAuth oficial** (`/api/v2/auth/token/get`, refresh com `/api/v2/auth/access_token/get`);
- validar, enviar e acompanhar uploads via **`media_space`** oficial (`init_video_upload` → `upload_video_part` → `complete_video_upload` → `get_video_upload_result`);
- **vincular** o vídeo carregado a produtos via `/api/v2/product/update_item`;
- agendar a aplicação do vídeo ao produto em data/hora, com fila BullMQ;
- centralizar metadados de listing (título, descrição) com templates reutilizáveis;
- dashboard operacional com status, logs, alertas e trilha de auditoria.

### O que este produto **não** faz (e por quê)

- **Não publica no feed Shopee Video** (estilo TikTok). Não existe API pública para isso — o feed é gerenciado exclusivamente pelo Seller Centre/App Shopee ou Creator Center. Automatizar essa publicação por scripts é explicitamente vetado pelo ToS da Shopee Live.
- **Não usa cookies, sessão ou browser automation.** Todo acesso é via Open Platform com assinatura HMAC-SHA256.
- **Não cobre Shopee Live** nem upload de stream ao vivo.

## Princípios do produto

1. **API oficial primeiro** — integração com a Shopee Open Platform sempre que houver endpoint documentado.
2. **Sem dependência de cookies/sessão como arquitetura principal** — scraping/browser automation apenas como trilha secundária, sujeita a validação jurídica e de compliance.
3. **Rastreabilidade total** — todo upload, agendamento, erro e reprocessamento é auditável.
4. **Arquitetura resiliente** — upload multipart com retomada, retries com backoff e estados intermediários persistidos.

## Estrutura do repositório

```
.
├── apps/
│   ├── web/        # Frontend Vite + React + TypeScript
│   ├── api/        # Backend Fastify + TypeScript + Prisma
│   └── worker/     # Worker BullMQ (upload multipart, polling Shopee)
├── packages/
│   └── shared/     # Tipos, constantes e validações compartilhadas (Zod)
├── prisma/         # Schema e migrations Postgres
├── docker-compose.yml
├── Index.html      # Protótipo estático de UI (referência visual)
├── Prd.md          # PRD completo em PT-BR
├── README.md       # Este arquivo
└── PLAN.md         # Plano de implementação por fases
```

## Protótipo de UI

`Index.html` é um mockup funcional de navegação em **vanilla HTML + CSS + JS**, sem build step. Contém as seguintes páginas:

| Página          | ID da seção         | Propósito                                                            |
| --------------- | ------------------- | -------------------------------------------------------------------- |
| Dashboard       | `page-dashboard`    | Visão consolidada de envios, fila, transcodificação, taxas de sucesso |
| Upload          | `page-upload`       | Envio individual ou em lote de vídeos                                |
| Agendamentos    | `page-agendamentos` | Calendário e fila de publicações                                     |
| Analytics       | `page-analytics`    | Métricas operacionais e de performance                               |
| Configurações   | `page-config`       | Preferências do workspace, templates, usuários                       |
| Integrações     | `page-integracoes`  | Conexão de contas Shopee e credenciais                               |

A navegação é feita via `data-page-target` e o script no final de `Index.html` alterna a classe `active`. É apenas **UI de referência** — não há chamadas reais à Shopee.

## Arquitetura alvo

| Camada         | Stack escolhida                                                           |
| -------------- | ------------------------------------------------------------------------- |
| Frontend       | **Vite + React + TypeScript**, TailwindCSS, React Router, TanStack Query  |
| Backend/API    | **Fastify + TypeScript**, Prisma ORM                                      |
| Fila/Workers   | **BullMQ + Redis** (Node + TypeScript, compartilha Prisma com a API)      |
| Banco          | PostgreSQL                                                                |
| Armazenamento  | S3-compatível (MinIO em dev) para staging temporário dos vídeos           |
| Infra          | Docker Compose em dev; deploy em DigitalOcean / Railway / Render / VPS    |
| Observabilidade | Sentry + logs estruturados (Pino)                                        |

> **Por que SPA (Vite) e não Next.js?** Este é um painel administrativo autenticado — não precisa de SSR, SEO ou rotas dinâmicas de conteúdo público. Vite entrega DX superior, build rápido e zero acoplamento a um framework full-stack. O backend fica isolado em Fastify, facilitando evolução independente.

**Por que backend + workers?** O fluxo oficial de upload consultado (`init_video_upload` → `upload_video_part` → `complete_video_upload` → `get_video_upload_result`) é multipart com polling de transcodificação. Fazer isso somente no navegador seria frágil — requer fila assíncrona, retomada e idempotência.

## Escopo MVP

### Fase 1 — oficialmente seguro

- Autenticação Shopee via fluxo oficial de autorização
- Gestão de múltiplas contas por workspace
- Upload oficial multipart (10–60s, até 30 MB, partes de 4 MB exceto a última)
- Polling de status (`INITIATED` / `TRANSCODING` / `SUCCEEDED` / `FAILED` / `CANCELLED`)
- Dashboard operacional
- Agendamento interno (fila, retries, backoff)
- Importação CSV/XLSX
- Logs, alertas, auditoria

### Fase 2 — condicionada a descoberta técnica

- Publicação automática em Shopee Video (depende de confirmação de endpoint público oficial)
- Edição e remoção de publicação
- Métricas específicas do canal de vídeo
- Templates avançados por campanha

## Dependências críticas e riscos

- **Endpoint de publicação não confirmado**: o fluxo consultado cobre upload do asset, mas **não comprova** a existência de endpoint público oficial para publicar como post em Shopee Video. Caso inexistente, a Fase 2 fica bloqueada ou limitada.
- **Limites de vídeo restritivos**: a especificação consultada indica **10–60 s** e **até 30 MB**, bem mais restritivo que os 500 MB / MP4-MOV-AVI sugeridos em rascunhos anteriores. Os limites oficiais prevalecem.
- **Compliance**: qualquer trilha baseada em cookies/browser automation precisa de validação jurídica e de termos da plataforma antes de qualquer implementação.

Ver `Prd.md` §11 para a matriz completa de riscos.

## Como executar

### Pré-requisitos

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose

### Setup

```bash
# Instalar dependências
pnpm install

# Subir infra local (postgres + redis + minio)
docker compose up -d

# Rodar migrations
pnpm --filter api prisma migrate dev

# Iniciar dev (web + api + worker em paralelo)
pnpm dev
```

Portas padrão:

| Serviço | Porta | URL                         |
| ------- | ----- | --------------------------- |
| web     | 5173  | http://localhost:5173       |
| api     | 3333  | http://localhost:3333       |
| postgres | 5432 | `postgres://publica:publica@localhost:5432/publica` |
| redis   | 6379  | `redis://localhost:6379`    |
| minio   | 9000  | http://localhost:9001 (console) |

### Protótipo HTML de referência

O `Index.html` original é mantido como referência visual. Para abrir:

```bash
python3 -m http.server 8080
# http://localhost:8080/Index.html
```

## Documentação

- [`Prd.md`](./Prd.md) — PRD original (preservado como referência histórica)
- [`AUDIT.md`](./AUDIT.md) — **Auditoria técnica** (abril/2026) com achados da Shopee Open Platform e correções de escopo **— leia primeiro**
- [`PLAN.md`](./PLAN.md) — Plano de implementação por fases, entregáveis e critérios de aceite (pós-auditoria)

## Roadmap

Resumo de alto nível — detalhes em `PLAN.md`.

- [x] PRD inicial
- [x] Protótipo de UI estático
- [x] **Descoberta técnica concluída** (ver `AUDIT.md`) — escopo pivotado para vídeos de listing
- [x] Fase 0 — Monorepo, CI, Docker Compose, Prisma, auth local
- [ ] Fase 1 — OAuth Shopee + `media_space` upload + `product.update_item` + agendamento
- [ ] Fase 2 — Métricas por produto, edição em massa de vídeos, templates avançados
- [ ] Fase 3 — Hardening, RBAC, auditoria completa, alertas, LGPD

---

> Projeto baseado em pesquisa da Shopee Open Platform. Veja `Prd.md` para referências específicas aos endpoints `media_space` e ao fluxo `get_access_token` / `refresh_access_token`.
