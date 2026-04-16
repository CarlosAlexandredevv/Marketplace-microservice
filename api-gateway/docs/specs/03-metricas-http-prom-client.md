# Spec: instrumentação de métricas HTTP com prom-client no api-gateway

## Contexto

O `api-gateway` (porta `3005`) já integra os demais serviços e aplica autenticação de forma centralizada com um padrão de guards diferente dos microserviços de domínio.

A stack de observabilidade já está pronta (SPEC 19), com o Prometheus configurado para coletar `GET /metrics` a cada 15s nos 5 serviços. Hoje os targets estão `down` porque o `api-gateway` ainda não expõe métricas no formato Prometheus.

Esta spec define a instrumentação de métricas HTTP no `api-gateway` com `prom-client`, mantendo `GET /metrics` público e sem contabilizar o próprio endpoint de métricas.

## Fora de escopo

- criar métricas de negócio customizadas;
- criar dashboards no Grafana;
- alterar arquivos do Prometheus/Grafana (já configurados).

---

## 1. Instalar dependência

1. Instalar `prom-client` no `api-gateway`.
2. Garantir que a dependência esteja versionada no `package.json` do serviço.

---

## 2. Criar `MetricsModule` global

Criar um módulo `@Global()` em `src/metrics/` contendo:

### 2.1 `MetricsService`

- Responsável por criar e expor o `Registry` do Prometheus.
- Deve inicializar `collectDefaultMetrics` usando o `Registry` do serviço.
- Deve criar e registrar:
  - `Counter` `http_requests_total`;
  - `Histogram` `http_request_duration_seconds`.
- Labels obrigatórias para as métricas HTTP:
  - `method`
  - `route`
  - `status_code`
- O `Histogram` deve registrar duração em segundos.

### 2.2 `HttpMetricsInterceptor` (registrado como `APP_INTERCEPTOR`)

- Interceptar todas as requisições HTTP do `api-gateway`.
- Capturar:
  - método HTTP;
  - rota normalizada (`route`);
  - código de status;
  - duração total da requisição em segundos.
- Incrementar `http_requests_total` e observar `http_request_duration_seconds` ao final da resposta (inclusive em erro).
- **Não** coletar métricas da rota `GET /metrics` para evitar loop de auto-observação.

### 2.3 `MetricsController`

- Expor `GET /metrics`.
- Retornar payload no formato textual Prometheus usando o `Registry` do serviço.
- Definir o `Content-Type` correto (`text/plain` no formato esperado pelo Prometheus).
- A rota deve ser pública.

---

## 3. Publicar `GET /metrics` no padrão do api-gateway

Como o `api-gateway` possui padrão próprio de guards globais:

1. Marcar explicitamente `GET /metrics` com o mecanismo de rota pública já adotado no gateway (decorator/metadado de `@Public` equivalente do próprio serviço).
2. Garantir que nenhum guard global do gateway bloqueie a coleta do Prometheus nessa rota.
3. Manter as demais rotas com o comportamento de autenticação atual, sem regressão.

---

## 4. Registrar `MetricsModule` no `AppModule`

1. Importar o `MetricsModule` no `AppModule` do `api-gateway`.
2. Garantir que o provider `APP_INTERCEPTOR` fique ativo para toda a aplicação.

---

## 5. Tabela de métricas expostas

Após a implementação, `GET /metrics` deve incluir:

| Métrica | Tipo | Labels | Objetivo |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total de requisições HTTP processadas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Distribuição de latência das requisições HTTP |
| métricas padrão Node.js (`collectDefaultMetrics`) | múltiplos | padrão do `prom-client` | Saúde/runtime do processo (CPU, memória, event loop, GC, etc.) |

---

## 6. Validação no Prometheus

1. Subir `api-gateway` e stack observabilidade.
2. Acessar `http://localhost:3005/metrics` e validar resposta textual Prometheus.
3. No Prometheus (`http://localhost:9090/targets`), validar target `api-gateway` como `UP`.
4. Executar chamadas em rotas do gateway e verificar presença de séries para:
   - `http_requests_total`;
   - `http_request_duration_seconds`.
5. Confirmar ausência de séries referentes ao endpoint `/metrics`.

---

## 7. Critérios de aceite (claros e testáveis)

1. `prom-client` está instalado no `api-gateway`.
2. Existe `MetricsModule` global com `MetricsService`, `HttpMetricsInterceptor` e `MetricsController`.
3. `HttpMetricsInterceptor` está registrado como `APP_INTERCEPTOR`.
4. `GET /metrics` responde em formato Prometheus e é público no padrão do gateway.
5. `GET /metrics` não é contabilizado em `http_requests_total` nem em `http_request_duration_seconds`.
6. As métricas `http_requests_total`, `http_request_duration_seconds` e métricas padrão do Node.js estão expostas.
7. O target do `api-gateway` aparece `UP` no Prometheus.
