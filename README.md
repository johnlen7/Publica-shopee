# Publica Shopee — Shopee Video Automator

Plataforma web para automação do fluxo de envio, organização, agendamento e monitoramento de vídeos destinados ao ecossistema **Shopee Video**, com foco em produtividade, rastreabilidade e redução de falhas manuais.

> **Status atual:** repositório em fase de concepção. Contém PRD detalhado (`Prd.md`) e protótipo de UI estático (`Index.html`). Implementação backend e integrações ainda não iniciadas.

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

Sellers e times de conteúdo que operam em volume na Shopee enfrentam um processo manual de publicação de vídeos: envios repetitivos, metadados inconsistentes, ausência de fila/retry, e pouca rastreabilidade de falhas. Este projeto busca entregar uma camada operacional sobre a **Shopee Open Platform** para:

- conectar múltiplas contas Shopee via fluxo oficial (`access_token` / `refresh_token`);
- validar, enviar e acompanhar uploads em lote;
- agendar publicações com fila de jobs e timezone por workspace;
- centralizar metadados (título, descrição, hashtags, categoria) com templates reutilizáveis;
- fornecer dashboard operacional com status, logs, alertas e trilha de auditoria.

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

- [`Prd.md`](./Prd.md) — PRD completo (objetivos, escopo funcional, modelo de dados, fluxos, riscos)
- [`PLAN.md`](./PLAN.md) — Plano de implementação por fases, entregáveis e critérios de aceite

## Roadmap

Resumo de alto nível — detalhes em `PLAN.md`.

- [x] PRD aprovado
- [x] Protótipo de UI estático
- [ ] Fase 0 — Setup de monorepo, CI, base de dados, infra mínima
- [ ] Fase 1 — Autenticação Shopee + upload oficial + dashboard + agendamento interno
- [ ] Descoberta técnica — validar endpoint de publicação Shopee Video
- [ ] Fase 2 — Publicação automática (condicionada)
- [ ] Hardening — observabilidade, RBAC, auditoria completa, alertas

---

> Projeto baseado em pesquisa da Shopee Open Platform. Veja `Prd.md` para referências específicas aos endpoints `media_space` e ao fluxo `get_access_token` / `refresh_access_token`.
