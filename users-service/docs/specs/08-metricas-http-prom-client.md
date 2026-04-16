# Spec: instrumentação de métricas HTTP com prom-client no users-service

## Contexto

O `users-service` (porta `3000`) usa autenticação com JWT e possui guard global, com exceção de rotas explicitamente públicas (`@Public`).

A infraestrutura de observabilidade já está ativa e o Prometheus tenta coletar `GET /metrics` a cada 15s. O target do serviço está `down` porque o endpoint ainda não existe.

Esta spec define a instrumentação HTTP do `users-service` com `prom-client`, expondo `GET /metrics` como rota pública e evitando contagem do próprio endpoint.

## Fora de escopo

- criação de métricas de negócio;
- criação de dashboards no Grafana;
- alterações em Prometheus/Grafana.

---

## 1. Instalar dependência

1. Instalar `prom-client` no `users-service`.
2. Versionar a dependência no `package.json`.

---

## 2. Criar `MetricsModule` global

Criar `src/metrics/` com módulo `@Global()` contendo:

### 2.1 `MetricsService`

- Instanciar e disponibilizar `Registry` dedicado.
- Chamar `collectDefaultMetrics` usando este `Registry`.
- Criar e registrar as métricas:
  - `http_requests_total` (`Counter`);
  - `http_request_duration_seconds` (`Histogram`).
- Labels obrigatórias:
  - `method`
  - `route`
  - `status_code`

### 2.2 `HttpMetricsInterceptor` (`APP_INTERCEPTOR`)

- Interceptar todas as requisições HTTP do serviço.
- Capturar `method`, `route`, `status_code` e duração (segundos).
- Atualizar `http_requests_total` e `http_request_duration_seconds` na finalização da requisição.
- Ignorar `GET /metrics` para evitar loop de auto-monitoramento.

### 2.3 `MetricsController`

- Expor `GET /metrics`.
- Aplicar `@Public` para bypass do guard JWT global.
- Retornar métricas no formato textual Prometheus com content-type apropriado.

---

## 3. Registrar módulo no `AppModule`

1. Registrar `MetricsModule` no `AppModule` do `users-service`.
2. Garantir registro do interceptor via provider `APP_INTERCEPTOR`.

---

## 4. Regra de exclusão de `/metrics`

1. O interceptor não deve contabilizar requests cuja rota resolvida seja `/metrics`.
2. A coleta do Prometheus sobre `/metrics` não pode gerar incremento das métricas HTTP instrumentadas.

---

## 5. Tabela de métricas expostas

| Métrica | Tipo | Labels | Objetivo |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Contagem total de requisições HTTP |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latência de requisições HTTP em segundos |
| métricas padrão Node.js (`collectDefaultMetrics`) | múltiplos | padrão do `prom-client` | Telemetria de runtime do processo |

---

## 6. Validação no Prometheus

1. Subir o `users-service`.
2. Validar `GET http://localhost:3000/metrics` retornando payload Prometheus.
3. Confirmar target `users-service` como `UP` em `http://localhost:9090/targets`.
4. Gerar tráfego em endpoints do serviço e confirmar séries de:
   - `http_requests_total`;
   - `http_request_duration_seconds`.
5. Confirmar que requisições em `/metrics` não alteram os contadores HTTP instrumentados.

---

## 7. Critérios de aceite (claros e testáveis)

1. `prom-client` instalado no `users-service`.
2. `MetricsModule` global criado com `MetricsService`, `HttpMetricsInterceptor` e `MetricsController`.
3. Interceptor registrado como `APP_INTERCEPTOR`.
4. `GET /metrics` é público com `@Public` e retorna formato Prometheus.
5. `GET /metrics` não entra em `http_requests_total` nem `http_request_duration_seconds`.
6. Métricas HTTP e métricas padrão Node.js aparecem no endpoint.
7. Target `users-service` fica `UP` no Prometheus.
