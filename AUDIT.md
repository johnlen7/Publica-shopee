# Auditoria Técnica — Shopee Open Platform (abril/2026)

> Documento derivado de pesquisa técnica profunda em fontes oficiais, SDKs comunitários e ToS da Shopee. Corrige e complementa o `Prd.md` original com achados que alteram o escopo do produto.

---

## TL;DR

O produto original foi concebido como **"Plataforma de Automação de Postagem para Shopee Video"** — entendendo "Shopee Video" como o **feed curto estilo TikTok** da Shopee. A pesquisa mostrou que:

> ### ⚠️ Não existe API pública oficial para publicar posts no feed "Shopee Video".
>
> - O endpoint `media_space` **existe e é oficial**, mas o `video_upload_id` que ele produz se destina a **vídeos de listagem de produto** (consumido por `product.add_item` / `product.update_item`), **não** ao feed social Shopee Video.
> - O feed **Shopee Video** é gerenciado exclusivamente via:
>   1. Seller Centre (upload manual web)
>   2. App Shopee (mobile)
>   3. Shopee Creator/Affiliate Center (web/app, sem API pública)
> - Integrações de parceiros grandes (BigSeller, SHOPLINE) que mostram "Shopee Video" operam por **acordos privados não-públicos** com a Shopee.
> - O **ToS do Shopee Live proíbe expressamente automação via scripts**; por extensão, publicação automatizada no feed Shopee Video por terceiros é **zona cinzenta/provavelmente violadora** do ToS.

### Decisão de produto

O escopo é **pivotado** para:

> **"Publica Shopee" — Gestor de vídeos de listagem de produto para sellers Shopee**

Esse reposicionamento é 100% suportado por API oficial, estável, documentada e dentro do ToS.

---

## Achados confirmados

### 1. Autenticação (OAuth 2.0)

Confirmado:

- Base URLs:
  - Produção: `https://partner.shopeemobile.com`
  - Sandbox: `https://partner.test-stable.shopeemobile.com`
- Fluxo: seller autoriza em link `/api/v2/shop/auth_partner?partner_id=...&timestamp=...&sign=...&redirect=...` → redirect com `?code=...&shop_id=...` (ou `main_account_id` para CBSC/merchant) → troca em `/api/v2/auth/token/get` → refresh em `/api/v2/auth/access_token/get`.
- Assinatura: **HMAC-SHA256** com `partner_key` como chave, saída **hex lowercase**.
- Base strings:
  - Public APIs (login, token): `partner_id + api_path + timestamp`
  - Shop APIs: `partner_id + api_path + timestamp + access_token + shop_id`
  - Merchant APIs (CBSC): `partner_id + api_path + timestamp + access_token + merchant_id`
- TTL tokens: `access_token` **4 horas**, `refresh_token` **30 dias** com **rotação a cada refresh** (o anterior é invalidado).
- CBSC (Global Stores) usam `merchant_id` e frequentemente exigem aprovação específica da Shopee para autorização em apps de terceiros.

### 2. Upload de vídeo via `media_space` (oficialmente suportado)

Confirmado via múltiplos SDKs comunitários e documentação seller:

| Endpoint | Método | Content-Type |
| -------- | ------ | ------------ |
| `/api/v2/media_space/init_video_upload` | POST | application/json |
| `/api/v2/media_space/upload_video_part` | POST | **multipart/form-data** |
| `/api/v2/media_space/complete_video_upload` | POST | application/json |
| `/api/v2/media_space/get_video_upload_result` | POST | application/json |
| `/api/v2/media_space/cancel_video_upload` | POST | application/json |

Regras:

- **Duração**: 10–60 s
- **Tamanho máx.**: 30 MB (via API; Seller Centre web chega a 50 MB)
- **Parte**: exatamente 4 MB; **última parte** pode ser menor
- **MD5**: hex lowercase para `file_md5` (arquivo inteiro) e `content_md5` (por parte)
- **Formato**: MP4/H.264, resolução ≥ 720p, preferencialmente 16:9
- **Estados**: `INITIATED`, `TRANSCODING`, `SUCCEEDED`, `FAILED`, `CANCELLED`
- **Sem webhook oficial** para término de transcodificação — **polling obrigatório** em `get_video_upload_result`.
- Tempo de transcodificação típico (comunidade): segundos a ~2 min para 30 MB.

### 3. Vinculação ao produto (caminho oficial real)

O `video_upload_id` obtido via `media_space` é consumido por:

- `/api/v2/product/add_item` (criar produto com vídeo)
- `/api/v2/product/update_item` (adicionar/alterar vídeo de produto existente)

Esse é **o único caminho oficial e documentado** para publicar um vídeo carregado via API.

### 4. Rate limits (sem evidência forte)

- **Não documentado publicamente** em fontes acessíveis.
- Relatos comunitários: ~10 QPS por `partner_id`, com limites adicionais por `shop_id` e por endpoint (endpoints de mídia tendem a ser mais restritivos).
- A plataforma deve implementar throttling defensivo e honrar `error_busy`.

### 5. SDKs

- **Sem SDK oficial** open-source da Shopee.
- Melhor opção comunitária TS: `congminh1254/shopee-sdk`.
- Decisão: implementação própria leve (a superfície usada é pequena), evitando dependência de wrapper de terceiros.

### 6. Códigos de erro comuns

`error_auth`, `error_param`, `error_permission`, `error_server`, `error_not_found`, `error_sign`, `error_inner`, `error_data`, `error_busy`, e específicos de mídia (ex.: `error.video_upload.part_md5_mismatch`, `error.video_upload.duration_invalid`, `error.video_upload.size_exceeded`).

Resposta padrão Open API v2:

```json
{ "error": "", "message": "", "request_id": "...", "response": { ... } }
```

---

## Impacto no PRD original

### Mantido sem alteração

- Princípios do produto (API oficial primeiro, sem cookies como arquitetura principal, rastreabilidade, arquitetura resiliente)
- Módulo de autenticação §6.1
- Módulo de upload §6.2 (com ajustes menores de validação)
- Módulo de metadados §6.5 (templates, validação de limites)
- Dashboard §6.6
- Observabilidade §6.7
- Requisitos não funcionais §7

### Corrigido / reduzido de escopo

| PRD §       | Status original                                  | Correção pós-auditoria                                                                 |
| ----------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| §1 Visão    | "Postagem para Shopee Video"                    | Gestão de **vídeos de listing de produto**                                             |
| §6.3 Publicação | Camada A + Camada B (condicional)            | **Removida Camada B** (feed Shopee Video). Camada A vira "vincular vídeo a produto via `product.update_item`". |
| §6.4 Agendamento | Publicação em Shopee Video                  | Agenda a **aplicação do vídeo ao produto** (update de listing) em data/hora.           |
| §11.1 Dependência crítica | "Confirmar endpoint de publicação"   | **Resolvida**: endpoint de publicação de feed não existe; fluxo de listing é definitivo. |
| §12 MVP Fase 2 | "Publicação automática em Shopee Video"     | **Removida**. Substituída por: métricas de produto, edição em massa de vídeos.        |

### Ajustes técnicos específicos no PRD

- §5.3 citava 10–60 s e até 30 MB — **confirmado**, nenhuma mudança.
- §5.4 listava estados `INITIATED`/`TRANSCODING`/`SUCCEEDED`/`FAILED`/`CANCELLED` — **confirmado**.
- §9 Modelo de dados — `publish_jobs` é renomeado conceitualmente para **"jobs de vinculação ao produto"**, mas a tabela é mantida com ajustes: adicionar `productItemId` (SKU Shopee), remover estados dependentes de publicação de feed.
- Os valores de 500 MB / MP4/MOV/AVI em escopos antigos são definitivamente **incorretos**; usar apenas limites do `media_space`.

---

## Riscos adicionais descobertos

| Risco                                                 | Mitigação                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Rate limits não documentados                         | Throttling por `partner_id`/`shop_id`; respeitar `error_busy`; métricas de 4xx/5xx. |
| Sem webhook de fim de transcodificação              | Polling com backoff (5s → 10s → 20s até 2 min).                           |
| `refresh_token` rotativo (o anterior é invalidado)  | Transação atômica ao atualizar DB; recuperar do último refresh em caso de crash. |
| Autorização CBSC exige aprovação manual Shopee     | Onboarding separado para merchants CBSC; mensagem clara na UI.            |
| ToS Shopee Live proíbe automação                    | Nunca implementar automação de Shopee Live ou feed Shopee Video.          |

---

## Anexo — Trilha não-oficial (RPA) para feed Shopee Video

> ⚠️ **Este anexo descreve um caminho NÃO oficial, fora do ToS recomendado.** Leia integralmente antes de usar.

Como a Shopee não expõe API pública para o feed Shopee Video (TikTok-like), alguns desenvolvedores implementam **RPA** (Robotic Process Automation) — um robô de navegador (Playwright/Selenium) que opera o Seller Centre como se fosse um humano. Este projeto oferece a infraestrutura para esse caminho como **módulo opcional separado** (`apps/rpa-bot`), explicitamente marcado como não-oficial.

### Riscos que o operador precisa assumir

| Risco                                      | Severidade | Observação                                                                                                   |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------ |
| Violação do ToS da Shopee                 | Alta       | ToS Shopee Live veta automação explícita. Para feed Video, o espírito é o mesmo. Seller pode ser banido.     |
| Detecção de automação                    | Alta       | `navigator.webdriver`, fingerprinting de canvas/WebGL/fonts, timing, CDP traces. "Stealth" é corrida perpétua. |
| Mudança de layout quebra robô             | Alta       | Selectors CSS/XPath frágeis; cada atualização do Seller Centre pode parar tudo.                              |
| Credenciais / sessão                      | Média      | Login automatizado = risco. Mitigação: sessão persistente + login manual inicial.                            |
| IP compartilhado de SaaS é marcado       | Alta       | Rodar no servidor → mesmo IP para todos os sellers → bloqueio rápido. Mitigação: **agente local**.           |
| Ausência de SLA e de suporte             | Alta       | Se quebrar, não há a quem reclamar.                                                                          |

### Decisões arquiteturais para mitigar (não eliminar) riscos

1. **Módulo separado**: `apps/rpa-bot` é um app Node.js que o seller **instala na máquina local dele**, não roda no SaaS.
2. **Persistent context**: `--user-data-dir` do Playwright salva sessão; seller loga manualmente uma vez.
3. **headful por padrão**: `headless: false` para o seller ver o que está acontecendo (auditoria visual) e reduzir flags anti-automação.
4. **Polling pull, não push**: bot puxa jobs pendentes da API (`GET /rpa/jobs/pending`) em vez de API empurrar — reduz superfície.
5. **Delay humanizado**: `random 300–1200 ms` entre ações; nada de clicks rajada.
6. **Isolamento de dados**: tabela `RpaJob` separada; audit log marca toda ação como `uses_unofficial_automation = true`.
7. **Opt-in explícito**: feature flag + consentimento registrado no workspace antes de habilitar.
8. **Kill switch**: cancelar job a qualquer momento, pausar worker, desinstalar bot.

### O que o RPA faz concretamente

Fluxo híbrido recomendado:

```
1. Upload OFICIAL via API (apps/worker, media_space)
   → obtém video_upload_id + remoteVideoUrl
2. RPA abre Seller Centre → Shopee Video → "Create Post"
3. RPA faz upload do arquivo local (mesmo binário que foi ao media_space)
   OU seleciona da media library se o video_upload_id aparecer lá
4. RPA preenche caption, hashtags, agendamento
5. RPA clica "Publicar"
```

Implementação em `apps/rpa-bot/README.md`.

---

## Conclusão

O projeto é **viável, mas com escopo reposicionado**. A versão ajustada é:

**Publica Shopee** — plataforma web para sellers Shopee gerenciarem em escala os **vídeos de listagem de produtos**, com:

- Conexão OAuth oficial multi-conta
- Upload em lote via `media_space` (validação local + multipart + polling)
- Vinculação do vídeo a produtos via `product.update_item`
- Agendamento de aplicação (data/hora)
- Templates de metadados (título, descrição — aplicáveis ao item)
- Dashboard operacional, logs, retries, alertas
- Importação CSV/XLSX para operação em lote
- RBAC por workspace, auditoria completa

Adicionalmente, como **módulo opt-in separado e de responsabilidade do operador**, o `apps/rpa-bot` oferece uma trilha não-oficial via Playwright para o feed Shopee Video — com os riscos de ToS e manutenção explicitamente documentados acima.
