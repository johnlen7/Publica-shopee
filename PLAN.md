# Plano de Implementação — Publica Shopee

Plano de execução **pós-auditoria técnica** (ver [`AUDIT.md`](./AUDIT.md)). Deriva do [`Prd.md`](./Prd.md) com escopo reposicionado para **gestão de vídeos de listing de produto Shopee** (o feed "Shopee Video" não tem API pública e foi removido do escopo).

> **Princípio guia:** cada fase deve entregar valor operacional mesmo que a próxima não seja iniciada. Todas as integrações usam endpoints **oficialmente documentados** da Shopee Open Platform — zero dependência de browser automation, scraping ou APIs não publicadas.

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
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3
Fundação   MVP core    Valor+       Hardening
```

Gate de descoberta técnica **já executado** (abril/2026) — ver `AUDIT.md`. Escopo congelado no caminho oficial `media_space` + `product.update_item`.

---

## Fase 0 — Fundação técnica

**Objetivo:** ter o esqueleto do produto rodando ponta a ponta (frontend → API → worker → banco), sem lógica de negócio.

### Entregáveis

- Monorepo (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`) ou repos separados — decidir no kickoff.
- Frontend **Vite + React + TypeScript + TailwindCSS** migrando a UI de `Index.html` para componentes React (SPA, sem SSR).
- API **Fastify + TypeScript + Prisma** com healthcheck e autenticação de usuário do workspace (não Shopee ainda).
- Worker **BullMQ** (Node + TS, compartilha Prisma com a API) com job de eco/teste.
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

**PRD §6.1 + AUDIT.md §1**

Fluxo OAuth 2.0 oficial confirmado:

1. UI dispara `POST /integrations/shopee/authorize` → backend gera URL `/api/v2/shop/auth_partner?partner_id=...&timestamp=...&sign=...&redirect=...&state=...`
2. Seller autoriza no portal Shopee → redirect `?code=...&shop_id=...` (ou `main_account_id` para CBSC)
3. Backend troca em `/api/v2/auth/token/get` → persiste `access_token` (TTL **4 h**) e `refresh_token` (TTL **30 d**) criptografados (AES-256-GCM)
4. Worker `token-refresh` roda scheduled (a cada 30 min) e renova tokens < 1 h de expirar via `/api/v2/auth/access_token/get`. **Refresh rotativo**: o antigo é invalidado, a transação de update no DB é atômica.
5. Assinatura HMAC-SHA256 hex lowercase com base strings corretas (public/shop/merchant).

**Critérios de aceite**

- Usuário conecta conta Shopee com sucesso (sandbox `partner.test-stable.shopeemobile.com`).
- Tokens persistidos criptografados; nenhum endpoint devolve tokens em claro.
- Renovação automática registrada em `audit_logs`.
- Conta CBSC (merchant_id) marcada visualmente com aviso de requisito de aprovação Shopee.
- Página Integrações lista contas com status (ACTIVE / EXPIRED / REVOKED / NEEDS_RECONNECT) e data de expiração.

### 1.2 Upload de vídeo via `media_space` (oficial)

**PRD §6.2, §5.2, §5.3 + AUDIT.md §2**

Pipeline confirmado:

1. Validação local client-side: tipo (MP4/MOV/AVI), duração (10–60 s), tamanho (≤ 30 MB).
2. Upload do binário para S3/MinIO (staging) — chunks diretos do cliente.
3. API enfileira job `init-upload` com `file_md5` (hex) e `file_size`.
4. Worker chama `POST /api/v2/media_space/init_video_upload` → recebe `video_upload_id`.
5. Worker baixa do S3 em partes de **exatamente 4 MB** (última pode ser menor), calcula `content_md5` hex por parte, envia via **multipart/form-data** em `POST /api/v2/media_space/upload_video_part` com `part_seq` 0-based.
6. Worker chama `POST /api/v2/media_space/complete_video_upload` com `part_seq_list` + `report_data`.
7. Worker inicia polling em `POST /api/v2/media_space/get_video_upload_result` com backoff 5s → 10s → 20s (cap 2 min). **Sem webhook oficial** — polling é obrigatório.
8. `POST /api/v2/media_space/cancel_video_upload` em caso de abort ou retry completo.

**Critérios de aceite**

- Upload em lote completa sem intervenção manual.
- Falha em uma parte → retry apenas daquela parte (`error.video_upload.part_md5_mismatch`).
- Estados `INITIATED` / `TRANSCODING` / `SUCCEEDED` / `FAILED` / `CANCELLED` refletidos na UI.
- Arquivos que violam regras locais rejeitados **antes** do upload.
- Arquivo removido do S3 após `SUCCEEDED` + confirmação de vinculação (retenção configurável).

### 1.3 Metadados e templates

**PRD §6.5**

- CRUD de templates (título, descrição, hashtags, categoria).
- Versionamento simples (cópia imutável ao editar).
- Aplicação em massa e preview antes do envio.
- Validação de limite de caracteres parametrizável; warning em duplicidade de título.

### 1.4 Vinculação ao produto (`product.update_item`)

**Novo — deriva de AUDIT.md §3**

Após transcodificação `SUCCEEDED`, o vídeo precisa ser **aplicado** a um produto (`item_id` Shopee) para ficar visível no catálogo. Fluxo:

1. Listar produtos do seller via `POST /api/v2/product/get_item_list` com paginação.
2. Usuário seleciona o produto (ou informa `item_id` na importação CSV).
3. Backend chama `POST /api/v2/product/update_item` passando `item_id` + `video_upload_id` (campo `video_info`).
4. Resposta confirma a atualização. Estado do `publish_job` vira `COMPLETED`.

### 1.5 Agendamento de aplicação

**PRD §6.4 reposicionado**

- Agendar data/hora para a **aplicação do vídeo ao produto** (update de listing).
- Timezone por workspace; importação CSV/XLSX com validação linha a linha (falhas individuais não derrubam o lote — PRD §6.4).
- Estados: `SCHEDULED` / `RUNNING` / `COMPLETED` / `FAILED` / `CANCELLED`.
- Guards: conta ACTIVE **e** upload `SUCCEEDED`.
- BullMQ delayed job com `jobId = publish_job.id` (cancelamento direto pelo ID).

### 1.6 Dashboard e observabilidade

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

## Descoberta técnica — CONCLUÍDA

Executada em abril/2026. Veredito em [`AUDIT.md`](./AUDIT.md):

- ❌ **Sem API pública para publicar no feed Shopee Video.**
- ✅ **`media_space` confirmado** para upload de vídeo.
- ✅ **`product.update_item` confirmado** como caminho oficial de "publicação" (vincular vídeo ao produto).
- ⚠️ ToS Shopee Live proíbe automação por scripts → automação do feed social fica permanentemente fora do escopo.

---

## Fase 2 — Valor adicional (pós-MVP)

Após Fase 1 estável, focar em recursos que **aprofundam valor** dentro do caminho oficial:

### Escopo

- **Edição em massa de vídeos de produto**: trocar o vídeo de N produtos com um template selecionado.
- **Desvinculação** (limpar `video_info` do produto).
- **Métricas operacionais de item**: cruzar `product.get_item_base_info` com status interno.
- **Templates avançados por campanha**: snapshots aplicáveis em bulk.
- **Import A/B de CSV/XLSX**: preview de impacto antes de confirmar.
- **Webhook outbound para sistemas do seller** (notificar quando upload/vinculação completa).

### Critérios de aceite

- Operação em massa de ≥ 500 produtos sem perda de consistência.
- Métricas de produto com cache e refresh programado.
- Templates com histórico de aplicações (quais produtos receberam qual versão).

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
| ~~Endpoint de publicação Shopee Video não existir~~ **(resolvido)**   | —     | —       | Escopo pivotado para vídeos de listing — ver `AUDIT.md`.                                     |
| Limites oficiais (30 MB / 60 s) inviabilizarem casos de uso do cliente | Alta  | Médio   | Comunicação clara no onboarding; validação local antecipa rejeição.                         |
| Rate limits não documentados                                         | Alta  | Médio   | Throttling por `partner_id` e `shop_id`; respeitar `error_busy`; circuit breaker por endpoint. |
| Refresh token rotativo invalidado por concorrência                   | Média | Alto    | Update em transação atômica com lock na linha; reteste em falha de auth.                     |
| Autorização CBSC exige aprovação Shopee                              | Média | Médio   | Onboarding separado; mensagem clara na UI; suporte a `shop_id` como caminho primário.        |
| ToS Shopee Live proíbe automação                                     | —     | —       | Escopo do produto exclui feed/live permanentemente.                                          |
| Vazamento de `access_token`                                           | Baixa | Alto    | AES-256-GCM em repouso, secrets em vault, logs sanitizados, rotação de `TOKEN_ENCRYPTION_KEY`. |
| Sem webhook de fim de transcodificação                               | Alta  | Baixo   | Polling com backoff (5s→10s→20s, cap 2 min); métricas de tempo médio por conta.              |
| Dívida técnica do protótipo HTML bloqueando migração para React       | —     | —       | `Index.html` mantido como referência; componentes Vite+React escritos do zero.              |

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
