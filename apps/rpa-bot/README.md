# apps/rpa-bot — Agente Playwright para Shopee Video (NÃO-OFICIAL)

> ⚠️ **Módulo opt-in, não-oficial.** Use por sua conta e risco. Veja [`AUDIT.md`](../../AUDIT.md#anexo--trilha-nao-oficial-rpa-para-feed-shopee-video).

Agente local que automatiza o upload de vídeos ao **feed Shopee Video** via Seller Centre, usando Playwright. Complementa a integração oficial (`media_space` + `product.update_item`) com o caminho do feed social que não tem API pública.

## Arquitetura

```
[Frontend UI] ─► [API principal] ─► [DB: RpaJob]
                                         ▲
                                         │ poll /rpa/jobs/claim
                                         │
                                  [apps/rpa-bot]
                                  (roda localmente)
                                         │
                                  Playwright (Chromium)
                                         │
                                 Seller Centre Shopee
```

- **Roda na máquina do seller**, não no SaaS.
- Usa **sessão persistente** (`--user-data-dir`) — seller faz login uma vez.
- Polling em `/rpa/jobs/claim` — a API empurra trabalho via fila.
- Reporta resultado em `/rpa/jobs/:id/result`.

## Requisitos

- Node.js 22+
- pnpm 10+
- Conexão de rede com a API principal
- Acesso ao Seller Centre Shopee da região configurada

## Instalação

```bash
# No repositório raiz
pnpm install

# Baixar binário do Chromium
pnpm --filter rpa-bot playwright:install

# Configurar variáveis
cp apps/rpa-bot/.env.example apps/rpa-bot/.env
# edite .env com API_URL + API_TOKEN (gerado por POST /auth/login)
```

## Primeiro uso — login manual

```bash
pnpm --filter rpa-bot setup-login
```

Isso abre o Chromium, navega ao Seller Centre da região configurada, e fica aguardando. Faça login normalmente (usuário/senha, OTP, captcha se pedir). Depois pressione **ENTER** no terminal — a sessão fica salva em `USER_DATA_DIR`.

## Rodar o agente

```bash
pnpm --filter rpa-bot start
```

Logs em JSON bonito (pino-pretty). O browser fica aberto e visível; o agent reivindica jobs pendentes e executa.

## Criar um job (via API)

```bash
curl -X POST https://app.exemplo.com/rpa/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoLocalPath": "promo-blackfriday.mp4",
    "caption": "Nossa campanha Black Friday começou!",
    "hashtags": ["BlackFriday", "Promocao"],
    "scheduledFor": "2026-11-28T10:00:00Z"
  }'
```

O `videoLocalPath` é **relativo** a `VIDEOS_ROOT` na máquina do agente. O arquivo precisa estar acessível localmente — a API principal **não** transfere o binário; o operador é responsável pela distribuição (ex.: pasta sincronizada por OneDrive/Dropbox).

## Seletores & manutenção

`src/selectors.ts` centraliza todos os seletores CSS. Quando o layout do Seller Centre mudar (o que acontece com regularidade):

1. Rode o agente com `HEADLESS=false`
2. Abra DevTools na página que quebrou
3. Ajuste o seletor correspondente em `selectors.ts`
4. Teste com um job de `dry-run` antes de reabrir para produção

## Limites conhecidos

- **Captcha / 2FA**: se o Seller Centre pedir no meio do fluxo, o agent trava. Operador precisa intervir manualmente no próprio browser.
- **Layout por região**: os seletores default foram validados em `seller.shopee.com.br`. Outras regiões podem diferir.
- **Agendamento**: o formato do date picker varia. O código assume `dd/mm/yyyy HH:mm` (BR).
- **Rate limit**: configurado via `POLL_INTERVAL_MS` (default 10s) + `humanDelay` entre ações (300–1200 ms). **Não** rode múltiplas instâncias na mesma conta.

## Kill switch

- Pause/desligue o processo: `Ctrl+C` (shutdown gracioso em até 5s).
- Cancele um job específico: `POST /rpa/jobs/:id/cancel` na API.
- Revogue consentimento: delete `RpaConsent` do workspace → toda criação de job retorna 403.

## Por que não está em produção

Este agente existe como **protótipo funcional**. Antes de operar em produção:

- [ ] Validar selectors em cada região-alvo
- [ ] Testes end-to-end com conta dedicada (nunca com conta de valor)
- [ ] Alertas de erro → operador humano
- [ ] Dry-run mode (sem clicar em publicar)
- [ ] Rotação de agent profile (múltiplas pastas `USER_DATA_DIR`) se operar mais de um workspace numa só máquina
