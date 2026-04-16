# Spec: instrumentação de métricas HTTP com prom-client no checkout-service

## Contexto

O `checkout-service` (porta `3003`) participa do fluxo de carrinho e fechamento de pedido no marketplace, com autenticação JWT aplicada globalmente e exceções explícitas para rotas públicas.

Na stack de observabilidade, o Prometheus já está configurado para coletar `GET /metrics`, mas o target do serviço permanece `down` porque o endpoint ainda não foi exposto.

Este plano define a instrumentação técnica HTTP com `prom-client` para habilitar visibilidade básica de volume e latência no serviço, mantendo o endpoint de métricas público e fora da própria contagem.

## Fora de escopo

- métricas de domínio (negócio);
- criação de dashboard Grafana;
- alterações em configuração de Prometheus/Grafana.

---

## 1. Instalar `prom-client`

1. Instalar `prom-client` no `checkout-service`.
2. Persistir a dependência no `package.json` e lockfile.

---

## 2. Criar `MetricsModule` global (`@Global`)

Criar `src/metrics/` com um módulo global contendo:

### 2.1 `MetricsService`

- Gerenciar `Registry` das métricas do serviço.
- Executar `collectDefaultMetrics` com o registry interno.
- Expor e registrar:
  - `http_requests_total` (`Counter`);
  - `http_request_duration_seconds` (`Histogram`).
- Labels mandatórias:
  - `method`
  - `route`
  - `status_code`

### 2.2 `HttpMetricsInterceptor` (`APP_INTERCEPTOR`)

- Interceptar requests HTTP em nível global.
- Medir duração total em segundos.
- Capturar método, rota e status final.
- Registrar dados em `http_requests_total` e `http_request_duration_seconds`.
- Excluir a rota `/metrics` da instrumentação para evitar loop.

### 2.3 `MetricsController`

- Criar endpoint `GET /metrics`.
- Marcar endpoint como público (`@Public`) para bypass do JWT guard global.
- Retornar saída textual compatível com o formato Prometheus.

---

## 3. Registrar `MetricsModule` no `AppModule`

1. Importar o módulo de métricas no `AppModule`.
2. Garantir interceptor global via provider `APP_INTERCEPTOR`.

---

## 4. Regra anti-loop de métricas

1. Requisições para `GET /metrics` não devem incrementar `http_requests_total`.
2. Requisições para `GET /metrics` não devem ser observadas em `http_request_duration_seconds`.

---

## 5. Tabela de métricas expostas

| Métrica | Tipo | Labels | Objetivo |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Contagem de requisições HTTP processadas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Distribuição da latência de respostas HTTP |
| métricas padrão Node.js (`collectDefaultMetrics`) | múltiplos | padrão do `prom-client` | Saúde de runtime (memória, CPU, event loop, GC etc.) |

---

## 6. Validação no Prometheus

1. Subir `checkout-service` e stack de observabilidade.
2. Acessar `http://localhost:3003/metrics` e validar retorno Prometheus.
3. Verificar `checkout-service` como `UP` em `http://localhost:9090/targets`.
4. Executar requests em endpoints de carrinho/checkout e validar séries de:
   - `http_requests_total`;
   - `http_request_duration_seconds`.
5. Confirmar que scrapes em `/metrics` não alteram as métricas HTTP customizadas.

---

## 7. Critérios de aceite (claros e testáveis)

1. `prom-client` instalado no `checkout-service`.
2. `MetricsModule` global criado com service/interceptor/controller.
3. `HttpMetricsInterceptor` ativo como `APP_INTERCEPTOR`.
4. `GET /metrics` público e em formato Prometheus.
5. Endpoint `/metrics` excluído da contagem de métricas HTTP customizadas.
6. Exposição de `http_requests_total`, `http_request_duration_seconds` e métricas padrão do Node.js.
7. Target do `checkout-service` fica `UP` no Prometheus.
