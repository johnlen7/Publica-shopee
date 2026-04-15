# Plano de Implementação — Publica Shopee

Plano de execução derivado de [`Prd.md`](./Prd.md) e do protótipo de UI em [`Index.html`](./Index.html). Organiza o trabalho em fases com entregáveis, critérios de aceite e dependências explícitas.

> **Princípio guia:** cada fase deve entregar valor operacional mesmo que a próxima não seja iniciada. A Fase 2 (publicação) é **condicionada** à confirmação de endpoint oficial.

---

## Índice

1. [Linha de fases](#linha-de-fases)
2. [Fase 0 — Fundação técnica](#fase-0--fundação-técnica)
3. [Fase 1 — MVP oficialmente seguro](#fase-1--mvp-oficialmente-seguro)
4. [Descoberta técnica (gate)](#descoberta-técnica-gate)
5. [Fase 2 — Publicação automática](#fase-2--publicação-automática-condicionada)
6. [Fase 3 — Hardening e escala](#fase-3--hardening-e-escala)
7. [Modelo de dados inicial](#modelo-de-dados-inicial)
8. [Matriz de riscos](#matriz-de-riscos)
9. [Definição de pronto (DoD)](#definição-de-pronto-dod)

---

## Linha de fases

```
Fase 0 ──► Fase 1 ──► Descoberta ──► Fase 2 (condicional) ──► Fase 3
Fundação   MVP oficial   Gate técnico    Publicação             Hardening
```

Cada fase tem exit criteria explícitos. Fase 2 só inicia se o gate de descoberta retornar verde.

---

## Fase 0 — Fundação técnica

**Objetivo:** ter o esqueleto do produto rodando ponta a ponta (frontend → API → worker → banco), sem lógica de negócio.

### Entregáveis

- Monorepo (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`) ou repos separados — decidir no kickoff.
- Frontend Next.js + TailwindCSS migrando a UI de `Index.html` para componentes React.
- API (NestJS/Fastify ou FastAPI) com healthcheck e autenticação de usuário do workspace (não Shopee ainda).
- Worker consumindo fila Redis/BullMQ com job de eco/teste.
- Postgres com migrations versionadas.
- Docker Compose local cobrindo api + worker + postgres + redis + minio (S3).
- CI mínima: lint + typecheck + testes unitários.
- Observabilidade básica: logs estruturados + Sentry.

### Critérios de aceite

- `docker compose up` sobe todo o stack localmente.
- É possível criar um usuário, logar, criar um workspace e enfileirar um job de teste.
- Pipeline de CI roda em cada PR e bloqueia merge em falhas.

### Dependências

Nenhuma externa. Bloqueia Fase 1.

---

## Fase 1 — MVP oficialmente seguro

Corresponde ao **MVP fase 1** do PRD (§12). Tudo que depende apenas de endpoints Shopee **confirmados** (autenticação e upload de vídeo).

### 1.1 Autenticação e integração Shopee

**PRD §6.1**

- Fluxo de autorização oficial Shopee Open Platform.
- Troca de `code` por `access_token` + `refresh_token` com persistência criptografada.
- Renovação automática antes da expiração (worker scheduled).
- Suporte a múltiplas contas Shopee por workspace.
- Detecção de token inválido → marcar conta como "precisa reconectar".

**Critérios de aceite**

- Usuário conecta conta Shopee e retorno é persistido.
- Tokens são criptografados em repouso (ex.: AES-GCM com chave em vault/env).
- Renovação ocorre sem intervenção e fica registrada em `audit_logs`.
- Página `integracoes` lista contas com status (ativa / expirada / revogada).

### 1.2 Upload de vídeo oficial

**PRD §6.2, §5.2, §5.3**

Pipeline:

1. Validação local: extensão, duração (10–60 s), tamanho (≤ 30 MB), integridade.
2. Cálculo de MD5 do arquivo.
3. Upload do binário para storage temporário (S3/MinIO) em chunks do cliente para a API.
4. Worker dispara `init_video_upload` → recebe `video_upload_id`.
5. Worker envia partes via `upload_video_part` (4 MB cada, exceto última).
6. Worker finaliza com `complete_video_upload`.
7. Polling de `get_video_upload_result` até estado terminal.
8. Suporte a cancelamento (`cancel_video_upload`) e retry parcial.

**Critérios de aceite**

- Upload em lote (ex.: 20 vídeos) completa sem intervenção manual.
- Falha em uma parte específica aciona retry da parte, não do arquivo inteiro.
- Estados `INITIATED` / `TRANSCODING` / `SUCCEEDED` / `FAILED` / `CANCELLED` refletidos na UI.
- Arquivos que violam regras locais são rejeitados **antes** do upload com mensagem explícita.

### 1.3 Metadados e templates

**PRD §6.5**

- CRUD de templates (título, descrição, hashtags, categoria).
- Versionamento simples (cópia imutável ao editar).
- Aplicação em massa e preview antes do envio.
- Validação de limite de caracteres parametrizável; warning em duplicidade de título.

### 1.4 Agendamento

**PRD §6.4**

- Agendar data/hora por vídeo com timezone do workspace.
- Importação CSV/XLSX com validação por linha (falhas individuais não derrubam o lote).
- Estados do job: `scheduled` / `running` / `completed` / `failed` / `cancelled`.
- Guard: job só roda se conta autenticada **e** upload do vídeo concluído.
- Reagendamento individual e em lote.

> **Observação:** enquanto a Fase 2 não estiver validada, o "run" do agendamento executa apenas as etapas oficialmente suportadas (ex.: confirmação de asset disponível). A publicação fica no status `pending_publish_api`.

### 1.5 Dashboard e observabilidade

**PRD §6.6, §6.7**

- KPIs: enviados, em fila, em transcodificação, publicados, falhos.
- Taxa de sucesso, tempo médio de upload, falhas por categoria.
- Timeline de atividades com filtro por conta/período/status.
- Retry configurável por tipo de falha + backoff exponencial.
- Correlation ID por job e trilha de auditoria completa.
- Alertas por e-mail/webhook/Slack para erros relevantes.

### Exit criteria da Fase 1

- Usuário leigo consegue: conectar conta → subir 10 vídeos em lote → agendar → acompanhar status no dashboard.
- Zero dependência de cookies/scraping.
- Cobertura de testes ≥ 70% nas rotinas de upload, token refresh e agendamento.
- Runbook de incidentes documentado.

---

## Descoberta técnica (gate)

**Antes** de iniciar a Fase 2, produzir um **Relatório de Descoberta** respondendo:

1. Existe endpoint público oficial na Shopee Open Platform para publicar um asset de vídeo como post em Shopee Video?
2. Quais campos são obrigatórios? (título, descrição, categoria, thumbnail, produtos vinculados?)
3. Existem endpoints oficiais para editar, despublicar e ler métricas?
4. Há rate limits ou restrições de domínio/região?
5. Caso não exista API oficial: quais alternativas (ex.: parceria, canal empresarial, app marketplace) e qual o risco jurídico de alternativas não oficiais?

**Gate verde:** endpoints existem e estão documentados → inicia Fase 2.

**Gate amarelo:** endpoints existem mas com restrições relevantes (ex.: whitelist, só via parceria) → avaliar viabilidade caso a caso.

**Gate vermelho:** não há endpoint oficial → Fase 2 fica em backlog, produto é entregue como "gestão de assets + agendamento interno", comunicação transparente ao cliente.

Entregável: `docs/discovery-shopee-video-publish.md` (criado no momento do gate).

---

## Fase 2 — Publicação automática (condicionada)

Só inicia se o gate for verde ou amarelo com plano aprovado.

### Escopo

- Publicação automática do asset via endpoint oficial confirmado.
- Edição de publicação (título, descrição, hashtags).
- Remoção/despublicação.
- Leitura de métricas específicas de Shopee Video.
- Integração do worker de agendamento com a chamada de publicação.

### Critérios de aceite

- Job agendado executa publicação real com sucesso e devolve URL pública do post.
- Falha de publicação aciona retry com backoff e abre incidente se persistir.
- Edição e remoção refletidas no dashboard em < 30 s.
- Métricas (views, engajamento, se disponíveis) aparecem em Analytics.

---

## Fase 3 — Hardening e escala

Endurecimento para uso em produção multi-cliente.

- **Segurança**: RBAC por workspace, rotação de chaves de criptografia, mascaramento em logs, 2FA opcional.
- **Escala**: sharding de filas por workspace, limites de concorrência por conta Shopee, backpressure.
- **Confiabilidade**: dead-letter queue com UI de reprocessamento, testes de chaos (queda de Redis, timeout de Shopee).
- **UX**: onboarding guiado, notificações in-app, mobile-friendly.
- **Compliance**: LGPD (export/erasure), retenção configurável de vídeos no staging, trilha de auditoria exportável.
- **SLO**: definir SLOs de upload e publicação; instrumentar error budget.

---

## Modelo de dados inicial

Resumo das tabelas definidas no PRD §9. Todas com `id` UUID, `created_at`, `updated_at`.

| Tabela            | Campos-chave                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `shopee_accounts` | `workspace_id`, `shop_id`, `merchant_id`, `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `status` |
| `videos`          | `workspace_id`, `original_filename`, `mime_type`, `file_size_bytes`, `duration_seconds`, `md5_hash`, `validation_status` |
| `video_uploads`   | `video_id`, `shopee_account_id`, `video_upload_id`, `upload_status`, `transcoding_status`, `remote_video_url`, `failure_reason` |
| `publish_jobs`    | `video_id`, `shopee_account_id`, `scheduled_for`, `timezone`, `status`, `retries_count`, `last_error`, `created_by` |
| `video_metadata`  | `video_id`, `title`, `description`, `hashtags_json`, `category`, `template_id`, `version`                          |
| `audit_logs`      | `actor_id`, `entity_type`, `entity_id`, `action`, `payload_json`                                                   |

Migrations versionadas (sugestão: Prisma ou Alembic dependendo da stack escolhida).

---

## Matriz de riscos

| Risco                                                                 | Prob. | Impacto | Mitigação                                                                                   |
| --------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------- |
| Endpoint de publicação Shopee Video não existir                      | Média | Alto    | Gate explícito de descoberta antes da Fase 2; MVP tem valor isolado (upload + agendamento). |
| Limites oficiais (30 MB / 60 s) inviabilizarem casos de uso do cliente | Média | Médio   | Comunicação clara no onboarding; validação local antecipa rejeição.                         |
| Rate limits / banimento por uso indevido                              | Baixa | Alto    | Throttling por conta; respeitar `Retry-After`; monitorar taxa de 4xx/5xx.                   |
| Compliance em trilhas alternativas (cookies/scraping)                 | Alta  | Alto    | Fora do MVP; exige parecer jurídico antes de qualquer prototipação.                         |
| Vazamento de `access_token`                                           | Baixa | Alto    | Criptografia em repouso, secrets em vault, logs sanitizados, revisão periódica de acessos.  |
| Dívida técnica do protótipo HTML bloqueando migração para React       | Média | Baixo   | Tratar `Index.html` como referência visual apenas; reescrever em componentes desde o início. |

Matriz completa e atualizações contínuas em `Prd.md` §11 + novos riscos descobertos em cada fase.

---

## Definição de pronto (DoD)

Uma tarefa está "pronta" quando:

1. Código revisado e mergeado via PR.
2. Testes unitários/integração passando em CI.
3. Migration aplicada em ambiente de homologação.
4. Feature flag (se aplicável) documentada.
5. Entrada no `CHANGELOG`.
6. Documentação de usuário atualizada (quando visível ao cliente).
7. Alertas/dashboards de observabilidade configurados (quando aplicável).
8. Revisão de segurança em tudo que toca token, arquivo ou PII.

---

> Este plano é vivo. Ao final de cada fase, revisar escopo da próxima à luz do que foi aprendido — especialmente após o gate de descoberta.
