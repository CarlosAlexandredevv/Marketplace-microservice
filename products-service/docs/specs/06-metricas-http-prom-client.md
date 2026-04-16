# Spec: instrumentação de métricas HTTP com prom-client no products-service

## Contexto

O `products-service` (porta `3001`) possui guard JWT global com liberação explícita de rotas públicas.

O Prometheus já está configurado para coletar `GET /metrics` no serviço, mas o target permanece `down` porque o endpoint ainda não foi implementado.

Esta spec define a instrumentação de métricas HTTP usando `prom-client`, com endpoint público de métricas e sem contabilizar `/metrics`.

## Fora de escopo

- métricas de negócio customizadas;
- dashboards no Grafana;
- mudanças na stack de observabilidade.

---

## 1. Instalar `prom-client`

1. Adicionar `prom-client` no `products-service`.
2. Persistir a dependência no `package.json` e lockfile do serviço.

---

## 2. Criar `MetricsModule` (`@Global`)

Criar `src/metrics/` com:

### 2.1 `MetricsService`

- Criar `Registry` próprio para métricas do serviço.
- Configurar `collectDefaultMetrics` no registry criado.
- Declarar e registrar:
  - `Counter` `http_requests_total`;
  - `Histogram` `http_request_duration_seconds`.
- Labels obrigatórias:
  - `method`
  - `route`
  - `status_code`

### 2.2 `HttpMetricsInterceptor` como `APP_INTERCEPTOR`

- Interceptar todas as requisições HTTP.
- Medir duração em segundos por request.
- Capturar método, rota e status HTTP final.
- Atualizar `http_requests_total` e `http_request_duration_seconds`.
- Ignorar a rota `/metrics` para evitar ciclo de auto-coleta.

### 2.3 `MetricsController`

- Implementar `GET /metrics`.
- Marcar rota como pública (`@Public`) para não exigir JWT.
- Retornar conteúdo Prometheus com `Content-Type` correto.

---

## 3. Registrar `MetricsModule` no `AppModule`

1. Importar `MetricsModule` no módulo raiz.
2. Garantir `HttpMetricsInterceptor` registrado globalmente via `APP_INTERCEPTOR`.

---

## 4. Exceção explícita para `/metrics`

1. O endpoint `/metrics` deve permanecer fora da instrumentação HTTP.
2. A coleta recorrente do Prometheus (15s) não pode afetar os contadores/histogramas HTTP customizados.

---

## 5. Tabela de métricas expostas

| Métrica | Tipo | Labels | Objetivo |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Quantidade de requests processados |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latência de requests HTTP |
| métricas padrão Node.js (`collectDefaultMetrics`) | múltiplos | padrão do `prom-client` | Sinais de runtime do processo Node |

---

## 6. Validação no Prometheus

1. Subir `products-service`.
2. Acessar `http://localhost:3001/metrics` e validar formato Prometheus.
3. Confirmar `products-service` como `UP` em `http://localhost:9090/targets`.
4. Chamar endpoints do catálogo e validar atualização de:
   - `http_requests_total`;
   - `http_request_duration_seconds`.
5. Confirmar que chamadas de scrape em `/metrics` não entram nas métricas HTTP customizadas.

---

## 7. Critérios de aceite (claros e testáveis)

1. `prom-client` instalado no `products-service`.
2. `MetricsModule` global implementado com service, interceptor e controller.
3. Interceptor registrado como `APP_INTERCEPTOR`.
4. `GET /metrics` é público e responde no padrão Prometheus.
5. `/metrics` não é contabilizado nas métricas HTTP customizadas.
6. Métricas `http_requests_total`, `http_request_duration_seconds` e métricas padrão Node.js estão expostas.
7. Target do `products-service` está `UP` no Prometheus.
