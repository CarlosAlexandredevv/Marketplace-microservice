# Spec: instrumentação de métricas HTTP com prom-client no payments-service

## Contexto

O `payments-service` (porta `3004`) processa pagamentos do marketplace e já é alvo de scrape no Prometheus (`GET /metrics` a cada 15s), mas ainda não expõe endpoint de métricas.

Como o serviço usa JWT guard global (com rotas públicas explícitas), `GET /metrics` deve ser público para a coleta funcionar sem autenticação.

Esta spec define a instrumentação HTTP com `prom-client` para habilitar observabilidade técnica básica do serviço.

## Fora de escopo

- criação de métricas de negócio (ex.: aprovados/rejeitados por regra);
- criação de dashboards no Grafana;
- mudanças em configuração de Prometheus/Grafana.

---

## 1. Instalar `prom-client`

1. Instalar `prom-client` no `payments-service`.
2. Garantir persistência no `package.json` e lockfile.

---

## 2. Criar `MetricsModule` (`@Global`)

Criar `src/metrics/` contendo:

### 2.1 `MetricsService`

- Criar `Registry` próprio de métricas.
- Executar `collectDefaultMetrics` vinculado ao registry.
- Registrar as métricas HTTP:
  - `http_requests_total` (`Counter`);
  - `http_request_duration_seconds` (`Histogram`).
- Labels obrigatórias:
  - `method`
  - `route`
  - `status_code`

### 2.2 `HttpMetricsInterceptor` (`APP_INTERCEPTOR`)

- Interceptar requests HTTP globais.
- Medir duração de cada request em segundos.
- Capturar `method`, `route` e `status_code`.
- Alimentar `http_requests_total` e `http_request_duration_seconds`.
- Ignorar rota `/metrics` para impedir loop de auto-observação.

### 2.3 `MetricsController`

- Expor `GET /metrics`.
- Marcar endpoint como público (`@Public`) para bypass de JWT guard.
- Retornar saída textual compatível com scraping do Prometheus.

---

## 3. Registrar no `AppModule`

1. Importar `MetricsModule` no `AppModule`.
2. Registrar interceptor global com token `APP_INTERCEPTOR`.

---

## 4. Exclusão de `/metrics` da instrumentação

1. O endpoint de métricas não deve incrementar `http_requests_total`.
2. O endpoint de métricas não deve registrar observações em `http_request_duration_seconds`.

---

## 5. Tabela de métricas expostas

| Métrica | Tipo | Labels | Objetivo |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Contagem de requisições HTTP processadas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Distribuição de tempo de resposta HTTP |
| métricas padrão Node.js (`collectDefaultMetrics`) | múltiplos | padrão do `prom-client` | Saúde/runtime de processo Node |

---

## 6. Validação no Prometheus

1. Subir `payments-service`.
2. Validar `GET http://localhost:3004/metrics` com payload no padrão Prometheus.
3. Confirmar target `payments-service` como `UP` em `http://localhost:9090/targets`.
4. Gerar requests em endpoints de pagamento e validar atualização das métricas HTTP.
5. Confirmar ausência de auto-coleta de `/metrics` nas métricas HTTP customizadas.

---

## 7. Critérios de aceite (claros e testáveis)

1. `prom-client` está instalado no `payments-service`.
2. Existe `MetricsModule` global com `MetricsService`, `HttpMetricsInterceptor` e `MetricsController`.
3. Interceptor registrado globalmente com `APP_INTERCEPTOR`.
4. `GET /metrics` é público e responde no formato Prometheus.
5. `/metrics` não é contabilizado nas métricas HTTP customizadas.
6. Métricas `http_requests_total`, `http_request_duration_seconds` e métricas padrão Node.js ficam disponíveis no endpoint.
7. Target do `payments-service` aparece `UP` no Prometheus.
