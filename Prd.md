PRD — Plataforma de Automação de Postagem para Shopee Video

1. Visão geral do produto

Desenvolver uma plataforma web para operacionalizar o fluxo de envio, organização, agendamento e monitoramento de vídeos destinados ao ecossistema Shopee, com foco em produtividade, rastreabilidade e redução de falhas manuais.

A solução deverá priorizar integração oficial com a Shopee Open Platform sempre que disponível. Onde não houver endpoint público oficial confirmado para publicação direta em Shopee Video, o sistema deverá tratar isso explicitamente como limitação do escopo oficial e prever alternativas controladas, sujeitas à validação jurídica, técnica e de compliance. 


---

2. Objetivo do negócio

Permitir que operadores, sellers ou times de conteúdo:

enviem vídeos em escala;

organizem metadados e calendário de publicação;

acompanhem progresso técnico do upload;

recebam logs e alertas em caso de falha;

reduzam tempo operacional e retrabalho.



---

3. Problema a ser resolvido

Hoje o processo de postagem de vídeos tende a ser manual, repetitivo e pouco auditável. Isso gera:

demora no envio de múltiplos vídeos;

inconsistência de título, descrição e hashtags;

falta de histórico técnico do que falhou;

ausência de fila, retry e observabilidade;

dificuldade para operar em volume.



---

4. Princípios do produto

1. API oficial primeiro
A solução deve usar integração oficial da Shopee sempre que houver suporte documentado.


2. Sem dependência de sessão/cookies como premissa principal
Sessões por cookie ou automação de navegador só podem existir como trilha secundária, pois têm risco operacional e de compliance maior. O fluxo oficial da Shopee é baseado em autorização, access_token e refresh_token, não em scraping como base principal. 


3. Rastreabilidade total
Cada upload, agendamento, erro e reprocessamento precisa ter histórico.


4. Arquitetura resiliente
O upload deve suportar retomada, retries e estados intermediários.




---

5. Descobertas oficiais relevantes para o PRD

5.1 Autenticação oficial

O fluxo documentado da Shopee Open Platform usa autorização para obtenção de access_token, com suporte a renovação por refresh_token. O material consultado também descreve cenários de autenticação por shop_id e por conta principal/merchant. 

5.2 Upload oficial de vídeo

A Shopee expõe fluxo de upload de vídeo via media_space, com etapas como:

init_video_upload

upload_video_part

complete_video_upload

get_video_upload_result

cancel_video_upload 


5.3 Regras técnicas do vídeo no fluxo consultado

No fluxo de media_space consultado:

o vídeo deve ter entre 10 e 60 segundos;

o tamanho máximo indicado é 30 MB;

o upload é feito em partes;

cada parte deve ter 4 MB, exceto a última;

o sistema precisa consultar o status até a transcodificação terminar. 


5.4 Status de processamento

Os estados retornados para processamento de vídeo incluem:

INITIATED

TRANSCODING

SUCCEEDED

FAILED

CANCELLED 


5.5 Limitação importante

Embora o upload de vídeo esteja documentado no fluxo consultado, isso não prova por si só a existência de um endpoint público oficial para “publicar Shopee Video” como post de feed/social. O PRD deve considerar isso como uma dependência crítica de descoberta técnica. 


---

6. Escopo funcional

6.1 Módulo de autenticação e integração

Requisitos

conectar conta Shopee por fluxo oficial de autorização;

armazenar com segurança access_token, refresh_token, shop_id e/ou merchant_id;

renovar token automaticamente antes da expiração;

detectar token inválido e solicitar reconexão apenas quando necessário;

permitir múltiplas contas Shopee por workspace.


Regras

não usar cookies/sessão como arquitetura principal;

registrar data de emissão, expiração e última renovação do token;

bloquear operações caso a conta não esteja autorizada.


Critérios de aceite

usuário conecta conta com sucesso;

tokens são persistidos com criptografia;

renovação automática ocorre sem intervenção manual;

erros de autenticação aparecem no painel com mensagem legível.


Base oficial consultada: fluxo com get_access_token e refresh_access_token. 


---

6.2 Módulo de upload automatizado

Requisitos

upload individual ou em lote;

validação local de extensão, duração, tamanho e integridade;

cálculo de hash MD5 do arquivo quando exigido;

inicialização do upload;

envio multipart por blocos;

finalização do upload;

polling de status até sucesso ou falha;

possibilidade de cancelar upload;

retry parcial quando falhar uma parte específica.


Regras de negócio

o sistema deve validar antes do envio se o arquivo atende ao fluxo consultado;

caso o vídeo não cumpra os limites oficiais do fluxo verificado, o sistema deve impedir o envio e exibir o motivo;

o backend deve persistir o identificador de upload retornado pela Shopee para retomada. 


Critérios de aceite

usuário acompanha progresso por arquivo;

upload interrompido pode ser reprocessado;

sistema exibe status INITIATED, TRANSCODING, SUCCEEDED, FAILED ou CANCELLED;

logs técnicos ficam acessíveis por item. 



---

6.3 Módulo de publicação / postagem

Escopo realista

Este módulo deve ser dividido em duas camadas:

Camada A — oficialmente suportada e confirmável

gestão do ativo de vídeo já carregado;

persistência de resultado do upload;

associação do asset a fluxo posterior, se houver endpoint oficial confirmado.


Camada B — dependente de descoberta

publicação direta em “Shopee Video”;

edição de post já publicado;

remoção de post;

leitura de métricas específicas de Shopee Video.


Observação crítica

Antes de prometer “publicação automática em Shopee Video”, o projeto precisa concluir uma etapa de validação técnica para confirmar se existe endpoint público oficial para esse tipo de postagem. No estado atual da verificação, isso permanece como dependência aberta. 

Critério de aceite provisório

se houver endpoint oficial confirmado: publicar com título, descrição e metadata;

se não houver: o sistema deve marcar a feature como “não disponível por API oficial”.



---

6.4 Módulo de agendamento

Requisitos

agendar data e hora por vídeo;

agendamento em massa por CSV/XLSX;

timezone por workspace;

reprogramação individual e em lote;

validação de conflitos e horários inválidos;

fila de jobs para execução automática.


Regras

jobs devem entrar em estado scheduled, running, completed, failed, cancelled;

o job só executa se a conta estiver autenticada e o vídeo estiver com upload concluído;

uploads não finalizados não podem ser agendados para publicação.


Critérios de aceite

usuário importa planilha com vários vídeos;

sistema agenda e valida todos os itens;

falhas individuais não derrubam o lote inteiro.



---

6.5 Módulo de metadados

Requisitos

preenchimento manual e em lote de:

título

descrição

hashtags

categoria/campanha

template de copy


templates reutilizáveis;

versionamento simples de template;

preview do conteúdo antes do envio/publicação.


Regras

limite de caracteres deve ser parametrizável;

termos proibidos ou inválidos podem ser validados por regra interna;

duplicidade de título pode gerar warning.


Critérios de aceite

usuário aplica template a múltiplos vídeos;

alterações em massa são rastreáveis;

metadados ficam associados ao vídeo e ao job.



---

6.6 Dashboard de gestão

Requisitos

visão geral de:

vídeos enviados

em fila

em transcodificação

publicados

falhos


taxa de sucesso operacional;

tempo médio de upload;

falhas por categoria;

timeline de atividades;

filtro por conta, período e status.


Critérios de aceite

dashboard carrega os últimos eventos;

cada vídeo possui status consolidado;

usuário consegue filtrar incidentes rapidamente.



---

6.7 Tratamento de erros e observabilidade

Requisitos

retry configurável por tipo de falha;

backoff exponencial;

logs técnicos completos;

alertas por e-mail, webhook ou Slack;

correlation ID por job;

trilha de auditoria de usuário.


Regras

erros de autenticação, rede, upload parcial e timeout devem ser classificados separadamente;

erros persistentes devem abrir incidente operacional;

logs devem guardar request ID interno, timestamps e payloads sanitizados.


Critérios de aceite

falha reproduzível fica visível no painel;

operador consegue reprocessar;

notificações disparam apenas em erros relevantes.



---

7. Requisitos não funcionais

7.1 Segurança

criptografia de tokens em repouso;

secrets em vault ou variáveis seguras;

controle por RBAC;

trilha de auditoria;

mascaramento de dados sensíveis em logs.


7.2 Performance

filas assíncronas para upload e agendamento;

jobs idempotentes;

processamento concorrente controlado;

polling desacoplado do request web.


7.3 Confiabilidade

retry com limites;

retomada de job;

dead-letter queue para falhas permanentes;

monitoramento de uptime e erro.


7.4 UX

interface responsiva;

feedback visual de progresso;

status claros;

mensagens legíveis para usuário não técnico.



---

8. Arquitetura sugerida

Frontend

Next.js / React

TailwindCSS

TanStack Query

tabela com paginação e filtros

dashboard com gráficos


Backend

Node.js com NestJS ou Fastify
ou

Python com FastAPI


Workers / fila

BullMQ + Redis
ou

Celery + Redis


Banco

PostgreSQL ou Supabase Postgres


Armazenamento

S3 compatível para staging temporário de vídeos

retenção curta para arquivos já enviados


Infra

Docker

deploy em DigitalOcean, Railway, Render ou VPS

observabilidade com Sentry + logs centralizados


Motivo arquitetural

Como o fluxo oficial consultado exige upload em partes, finalização e polling de status, a solução precisa de backend assíncrono e workers. Fazer isso apenas no frontend seria frágil e pouco confiável. 


---

9. Modelo de dados inicial

Tabela shopee_accounts

id

workspace_id

shop_id

merchant_id

access_token_encrypted

refresh_token_encrypted

token_expires_at

status

connected_at

updated_at


Tabela videos

id

workspace_id

original_filename

mime_type

file_size_bytes

duration_seconds

md5_hash

local_storage_path

validation_status

created_at


Tabela video_uploads

id

video_id

shopee_account_id

video_upload_id

upload_status

transcoding_status

remote_video_url

remote_thumbnail_url

failure_reason

started_at

finished_at


Tabela publish_jobs

id

video_id

shopee_account_id

scheduled_for

timezone

status

retries_count

last_error

created_by

created_at

updated_at


Tabela video_metadata

id

video_id

title

description

hashtags_json

category

template_id

version


Tabela audit_logs

id

actor_id

entity_type

entity_id

action

payload_json

created_at



---

10. Fluxos principais

10.1 Fluxo de conexão

1. Usuário inicia conexão.


2. Plataforma redireciona para autorização Shopee.


3. Recebe code.


4. Backend troca code por access_token e refresh_token.


5. Tokens são armazenados.


6. Conta fica apta para operações. 



10.2 Fluxo de upload

1. Usuário envia vídeo.


2. Sistema valida tamanho, duração e formato.


3. Backend calcula MD5.


4. Chama init_video_upload.


5. Envia partes com upload_video_part.


6. Finaliza com complete_video_upload.


7. Consulta get_video_upload_result até concluir.


8. Guarda URLs e status final. 



10.3 Fluxo de agendamento

1. Usuário define data/hora.


2. Job entra na fila.


3. Worker verifica autenticação e pré-condições.


4. Executa rotina de publicação, se oficialmente suportada.


5. Registra sucesso ou erro.




---

11. Riscos e dependências

11.1 Dependência crítica

A principal dependência é confirmar se existe endpoint público oficial para criação/publicação de Shopee Video como post. Sem isso, o produto pode ficar limitado a autenticação, upload do asset e orquestração interna. 

11.2 Risco de escopo incorreto

O escopo atual menciona vídeos de até 500 MB e formatos MP4/MOV/AVI, mas o fluxo oficial de upload consultado para vídeo aponta regras bem mais restritivas, incluindo 10–60 segundos e até 30 MB. Então esses limites precisam ser tratados como hipótese de negócio, não como premissa oficial validada. 

11.3 Risco de compliance

Uso de cookies, sessões ou browser automation como mecanismo principal pode violar expectativas de estabilidade e eventualmente termos da plataforma. O PRD deve priorizar integração oficial e só considerar mecanismos alternativos após validação jurídica e de risco.


---

12. Escopo MVP recomendado

MVP fase 1 — oficialmente seguro

autenticação Shopee

gestão de contas

upload oficial de vídeo

polling e monitoramento de status

dashboard operacional

agendamento interno

logs, retries, alertas

importação CSV/XLSX


MVP fase 2 — condicionado a descoberta

publicação automática em Shopee Video

edição de publicação

métricas específicas do canal de vídeo

templates avançados por campanha



---

13. Entregáveis

aplicação web funcional;

backend com fila de jobs;

integração oficial de autenticação;

fluxo oficial de upload de vídeo;

dashboard administrativo;

documentação técnica e operacional;

repositório GitHub;

guia de implantação;

matriz de riscos e limitações da API;

relatório de descoberta sobre publicação em Shopee Video.



---

14. Critérios de sucesso

reduzir tempo manual por lote de vídeos;

aumentar previsibilidade operacional;

ter rastreabilidade completa do envio;

diminuir falhas não diagnosticadas;

operar com integração oficial sempre que possível.



---

15. Versão recomendada do escopo original

Aqui está uma versão mais forte e mais honesta do seu texto base, pronta para colar em proposta ou PRD:

SCOPO — Automação de Operações de Vídeo para Shopee

1. Autenticação & Integração
Conexão com conta Shopee via fluxo oficial de autorização da Shopee Open Platform, com gerenciamento seguro de access_token e refresh_token, renovação automática, detecção de expiração e suporte a múltiplas contas por workspace. O sistema não deve depender de cookies/sessão como arquitetura principal. 

2. Upload Automatizado
Upload em lote de vídeos com validação prévia de regras técnicas, inicialização de sessão de upload, envio multipart por partes, finalização, polling de transcodificação, retry parcial e cancelamento. O fluxo consultado da Shopee para upload de vídeo usa init_video_upload, upload_video_part, complete_video_upload e get_video_upload_result, com status como INITIATED, TRANSCODING, SUCCEEDED, FAILED e CANCELLED. 

3. Agendamento de Publicação
Sistema de agenda para definir data/hora de execução por vídeo, com suporte a timezone, importação em massa por CSV/XLSX, fila de jobs e reprocessamento controlado. A execução final da publicação dependerá da confirmação de endpoint público oficial para Shopee Video.

4. Metadados por Vídeo
Preenchimento manual ou automatizado de título, descrição, hashtags, categoria e templates reutilizáveis, com preview e histórico de alterações.

5. Dashboard de Gestão
Painel web com visão consolidada de vídeos enviados, em fila, em transcodificação, concluídos e com falha, além de taxa de sucesso, tempo médio de upload, logs e alertas operacionais.

6. Tratamento de Erros
Retry configurável por tipo de erro, backoff exponencial, logs detalhados, auditoria e notificações por e-mail/webhook para falhas persistentes.

7. Stack sugerida
Frontend em Next.js/React + TailwindCSS; backend em Node.js ou Python; fila com Redis/BullMQ ou Celery; banco PostgreSQL/Supabase; deploy via Docker.

8. Entregáveis
Ferramenta funcional com interface web, documentação de uso, documentação técnica, código-fonte em GitHub e relatório de limitações oficiais da Shopee API aplicáveis ao fluxo de Shopee Video.

9. Observação de escopo crítico
O projeto deve considerar como dependência de descoberta a existência ou não de endpoint público oficial para publicação direta em Shopee Video. Caso essa capacidade não esteja disponível na Open Platform pública, o produto deverá limitar-se ao escopo oficialmente suportado ou submeter alternativas a validação jurídica/técnica. 
