# Spec: dashboards Grafana e métricas de negócio no marketplace-ms

## Contexto

O `marketplace-ms` possui 5 microserviços NestJS com métricas HTTP técnicas já instrumentadas via `prom-client` e expostas em `GET /metrics`. O Prometheus já realiza scrape de todos os serviços a cada 15s e o Grafana já está disponível na porta `3010` com datasource Prometheus pré-configurado.

Além de métricas técnicas (`http_requests_total`, `http_request_duration_seconds` e métricas padrão do Node.js), precisamos evoluir a observabilidade com métricas de negócio e dashboards versionados no repositório para análise operacional e de produto.

O `MetricsService` é `@Global` e já expõe o `Registry`, permitindo registro de métricas customizadas por domínio sem mudança na infraestrutura atual.

## Fora de escopo

- configurar alerting no Grafana/Prometheus;
- adicionar métricas de banco de dados;
- adicionar métricas via RabbitMQ exporter;
- alterar infraestrutura atual de Prometheus ou Grafana (incluindo `docker-compose.yml`).

---

## 1. Métricas de negócio customizadas

## 1.1 `payments-service`

Implementar e expor no mesmo `Registry` do `MetricsService`:

- `payments_processed_total` (`Counter`)
  - Incrementa para todo pagamento processado (aprovado ou rejeitado).
  - Labels: sem labels obrigatórias adicionais.
- `payments_approved_total` (`Counter`)
  - Incrementa quando pagamento é aprovado.
  - Labels: sem labels obrigatórias adicionais.
- `payments_rejected_total` (`Counter`)
  - Incrementa quando pagamento é rejeitado.
  - Labels obrigatórias:
    - `reason` (ex.: `insufficient_funds`, `fraud_suspected`, `gateway_error`, `validation_error`).

Regras:

1. As três métricas devem ser monotônicas (somente incremento).
2. `payments_processed_total` deve ser consistente com aprovados + rejeitados no recorte temporal.
3. O label `reason` deve usar valores controlados (sem texto livre).

## 1.2 `checkout-service`

Implementar e expor no mesmo `Registry` do `MetricsService`:

- `orders_created_total` (`Counter`)
  - Incrementa a cada pedido criado com sucesso.
  - Labels: sem labels obrigatórias adicionais.
- `rabbitmq_messages_published_total` (`Counter`)
  - Incrementa a cada publicação de mensagem realizada pelo serviço.
  - Labels obrigatórias:
    - `queue` (nome lógico da fila/rota de publicação).

Regras:

1. `orders_created_total` deve ser incrementada apenas após confirmação de criação do pedido.
2. `rabbitmq_messages_published_total` deve incrementar por mensagem efetivamente publicada.
3. O label `queue` deve refletir nome estável e de baixa cardinalidade.

---

## 2. Dashboard: `Marketplace Overview`

Criar dashboard de visão executiva e operacional com painéis por serviço.

### 2.1 Painéis obrigatórios

1. Status `UP/DOWN` de cada serviço (baseado em `up` do Prometheus).
2. Throughput geral (`requests/s`) por serviço.
3. Taxa de erros HTTP (4xx e 5xx) por serviço.
4. Latência `P95` por serviço.
5. Uso de memória por serviço.
6. Métricas de negócio consolidadas:
   - pagamentos processados/aprovados/rejeitados;
   - pedidos criados;
   - mensagens publicadas no RabbitMQ por fila.

### 2.2 Diretrizes visuais mínimas

1. Usar intervalo padrão de 15m com opção de alteração via timepicker.
2. Exibir legendas com nome de serviço consistente entre painéis.
3. Exibir unidade correta em cada painel (`req/s`, `s`, `bytes`, `ops/s`).
4. Destacar erro e indisponibilidade com cores semânticas (amarelo/vermelho).

---

## 3. Dashboard: `Service Details` (variável `$service`)

Criar dashboard detalhado para análise por serviço, com variável de template:

- Variável: `$service`
- Origem: label `job` do Prometheus
- Seleção padrão: todos os serviços

### 3.1 Painéis obrigatórios

1. RED por rota (Rate, Errors, Duration):
   - `Rate`: requests/s por `route` e `method`;
   - `Errors`: taxa e volume de 4xx/5xx por `route` e `method`;
   - `Duration`: `P50`, `P95`, `P99` por `route`.
2. Top rotas por volume (tabela) com ordenação decrescente.
3. Distribuição de status codes (pie chart).
4. Recursos de processo:
   - CPU;
   - memória;
   - event loop lag.

### 3.2 Regras de filtro

1. Todos os painéis devem respeitar `$service`.
2. Consultas por rota devem excluir `/metrics`.
3. Evitar séries de alta cardinalidade em painéis de overview.

---

## 4. Provisioning de dashboards via JSON (versionado)

Versionar dashboards no repositório para garantir reprodutibilidade entre ambientes.

### 4.1 Estrutura esperada

1. Salvar JSONs em diretório versionado de dashboards do `observability-stack`.
2. Manter nomes explícitos:
   - `marketplace-overview.json`
   - `service-details.json`
3. Criar/ajustar arquivo de provisioning de dashboards do Grafana para carregar automaticamente os JSONs.

### 4.2 Requisitos de versionamento

1. Toda alteração visual/PromQL relevante deve virar diff em JSON no git.
2. UID de cada dashboard deve ser estável para permitir update idempotente.
3. Datasource deve usar o Prometheus já provisionado (sem criação manual via UI).

---

## 5. Referência PromQL (queries principais)

| Objetivo | Query PromQL base |
| --- | --- |
| Status por serviço | `up{job=~"$service|api-gateway|checkout-service|payments-service|products-service|users-service"}` |
| Throughput por serviço | `sum by (job) (rate(http_requests_total{route!="/metrics"}[5m]))` |
| Erro 4xx por serviço | `sum by (job) (rate(http_requests_total{status_code=~"4..",route!="/metrics"}[5m]))` |
| Erro 5xx por serviço | `sum by (job) (rate(http_requests_total{status_code=~"5..",route!="/metrics"}[5m]))` |
| Taxa de erro total (%) | `100 * (sum by (job) (rate(http_requests_total{status_code=~"4..|5..",route!="/metrics"}[5m])) / sum by (job) (rate(http_requests_total{route!="/metrics"}[5m])))` |
| Latência P95 por serviço | `histogram_quantile(0.95, sum by (le, job) (rate(http_request_duration_seconds_bucket{route!="/metrics"}[5m])))` |
| Latência P95 por rota | `histogram_quantile(0.95, sum by (le, route, method) (rate(http_request_duration_seconds_bucket{job="$service",route!="/metrics"}[5m])))` |
| Latência P50 por rota | `histogram_quantile(0.50, sum by (le, route, method) (rate(http_request_duration_seconds_bucket{job="$service",route!="/metrics"}[5m])))` |
| Latência P99 por rota | `histogram_quantile(0.99, sum by (le, route, method) (rate(http_request_duration_seconds_bucket{job="$service",route!="/metrics"}[5m])))` |
| Top rotas por volume | `topk(10, sum by (route, method) (rate(http_requests_total{job="$service",route!="/metrics"}[5m])))` |
| Status code distribution | `sum by (status_code) (rate(http_requests_total{job="$service",route!="/metrics"}[5m]))` |
| Memória por serviço | `process_resident_memory_bytes{job=~"$service|api-gateway|checkout-service|payments-service|products-service|users-service"}` |
| CPU por serviço | `rate(process_cpu_seconds_total{job="$service"}[5m])` |
| Event loop lag (média) | `nodejs_eventloop_lag_seconds{job="$service"}` |
| Pagamentos processados/s | `sum(rate(payments_processed_total[5m]))` |
| Pagamentos aprovados/s | `sum(rate(payments_approved_total[5m]))` |
| Pagamentos rejeitados/s por motivo | `sum by (reason) (rate(payments_rejected_total[5m]))` |
| Pedidos criados/s | `sum(rate(orders_created_total[5m]))` |
| Mensagens publicadas/s por fila | `sum by (queue) (rate(rabbitmq_messages_published_total[5m]))` |

Notas:

1. Ajustar `job` conforme convenção final dos targets no Prometheus.
2. Se `nodejs_eventloop_lag_seconds` não estiver disponível, substituir por métrica equivalente do `prom-client` exposta no serviço.

---

## 6. Plano de implementação por etapas

1. Instrumentar métricas de negócio no `payments-service`.
2. Instrumentar métricas de negócio no `checkout-service`.
3. Validar exposição das novas métricas via `GET /metrics` em ambos.
4. Criar dashboard JSON `Marketplace Overview`.
5. Criar dashboard JSON `Service Details` com variável `$service`.
6. Configurar provisioning de dashboards no Grafana para carregamento automático.
7. Validar dashboards com carga real/sintética e revisar legibilidade.

---

## 7. Critérios de aceite (claros e testáveis)

1. `payments-service` expõe `payments_processed_total`, `payments_approved_total`, `payments_rejected_total` e esta última contém label `reason`.
2. `checkout-service` expõe `orders_created_total` e `rabbitmq_messages_published_total` com label `queue`.
3. Dashboard `Marketplace Overview` existe, carrega no Grafana e contém todos os painéis obrigatórios definidos na seção 2.
4. Dashboard `Service Details` existe, carrega no Grafana, possui variável `$service` funcional e contém todos os painéis obrigatórios da seção 3.
5. Dashboards estão versionados em arquivos JSON no repositório e são carregados por provisioning (sem criação manual obrigatória na UI).
6. Todas as queries listadas como principais na seção 5 executam sem erro no Prometheus/Grafana no ambiente local.
7. Painéis de HTTP não consideram a rota `/metrics`.
8. Não há alteração em alerting, métricas de banco de dados, RabbitMQ exporter ou infraestrutura de Prometheus/Grafana.

---

## 8. Evidências mínimas esperadas no PR

1. Diff dos arquivos de instrumentação de métricas customizadas nos serviços.
2. Diff dos JSONs dos dois dashboards.
3. Diff do provisioning de dashboards do Grafana.
4. Capturas de tela do `Marketplace Overview` e do `Service Details` com dados visíveis.
5. Captura do endpoint `/metrics` de `payments-service` e `checkout-service` contendo as novas métricas.
