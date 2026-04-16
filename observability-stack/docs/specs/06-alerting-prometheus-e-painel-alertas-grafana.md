# Spec: alerting Prometheus e painel de alertas ativos no Grafana

## Contexto

O `marketplace-ms` já possui métricas HTTP e dashboards no Grafana, mas ainda não tem regras de alerta versionadas para detectar indisponibilidade, degradação técnica e anomalias de negócio.

Esta spec define:

1. criação de `alert.rules.yml` no `observability-stack` com regras padronizadas;
2. inclusão de painel de alertas ativos no dashboard `Marketplace Overview`.

## Fora de escopo

- configuração de notificações externas (Slack, e-mail, webhook);
- readiness/liveness probes;
- mudanças em métricas existentes;
- alterações em painéis existentes além da adição do painel de alertas ativos.

---

## 1. Arquivo de regras `alert.rules.yml`

Criar/atualizar arquivo de regras no Prometheus com grupo dedicado (ex.: `marketplace-alerts`).

### 1.1 Alerta `ServiceDown`

- Expressão: `up{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"} == 0`
- `for: 30s`
- `severity: critical`
- Objetivo: detectar serviço fora do ar rapidamente.

### 1.2 Alerta `HighErrorRate`

- Critério: taxa de erro HTTP 5xx acima de 10%.
- Janela: `1m`.
- `severity: warning`
- Referência de cálculo:
  - numerador: `rate(http_requests_total{status_code=~"5..",route!="/metrics"}[1m])`
  - denominador: `rate(http_requests_total{route!="/metrics"}[1m])`
  - avaliação por serviço (`job`).

### 1.3 Alerta `HighLatencyP95`

- Critério: `P95 > 2s`.
- Janela: `1m`.
- `severity: warning`
- Query base por serviço:
  - `histogram_quantile(0.95, sum by (le, job) (rate(http_request_duration_seconds_bucket{route!="/metrics"}[1m]))) > 2`

### 1.4 Alerta `HighMemoryUsage`

- Critério: memória residente acima de `512MB`.
- Janela: `2m`.
- `severity: warning`
- Query base:
  - `process_resident_memory_bytes{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"} > 536870912`

### 1.5 Alerta `NoPaymentsProcessed`

- Critério: nenhum pagamento processado em 5 minutos.
- Janela de avaliação: `5m`.
- `severity: info`
- Query base:
  - `increase(payments_processed_total[5m]) == 0`

### 1.6 Alerta `HighPaymentRejectionRate`

- Critério: rejeição de pagamento acima de 50%.
- Janela: `2m`.
- `severity: warning`
- Referência de cálculo:
  - numerador: `rate(payments_rejected_total[2m])`
  - denominador: `rate(payments_processed_total[2m])`
  - expressão: `(numerador / denominador) > 0.5`
- Proteger divisão por zero com abordagem segura (ex.: clamp mínimo no denominador ou filtro por volume > 0).

---

## 2. Integração das regras no Prometheus

1. Garantir que `prometheus.yml` referencie `alert.rules.yml`.
2. Validar sintaxe com `promtool check rules`.
3. Confirmar carregamento sem erro na tela de `Status > Rules` do Prometheus.

---

## 3. Painel de alertas ativos no `Marketplace Overview`

Adicionar **apenas** um painel novo no dashboard existente `marketplace-overview.json`:

1. Tipo recomendado: `Alert list`.
2. Escopo: alertas do grupo `marketplace-alerts`.
3. Exibir ao menos:
   - nome do alerta;
   - severidade;
   - serviço (`job` quando aplicável);
   - estado atual (firing/pending).
4. Não alterar painéis existentes além do necessário para posicionar o novo painel.

---

## 4. Rotulagem e anotações das regras

Cada regra deve conter:

1. `labels` com `severity`.
2. `annotations` com:
   - `summary` curto e objetivo;
   - `description` com condição e impacto esperado.

---

## 5. Plano de validação

1. Derrubar temporariamente um serviço e validar disparo de `ServiceDown`.
2. Induzir erro 5xx e validar `HighErrorRate`.
3. Induzir latência e validar `HighLatencyP95`.
4. Simular pressão de memória e validar `HighMemoryUsage`.
5. Pausar processamento de pagamentos e validar `NoPaymentsProcessed`.
6. Simular alta rejeição de pagamentos e validar `HighPaymentRejectionRate`.
7. Confirmar que alertas aparecem no novo painel do `Marketplace Overview`.

---

## 6. Critérios de aceite (claros e testáveis)

1. Existe arquivo `alert.rules.yml` versionado no `observability-stack` com as 6 regras exigidas.
2. Cada regra possui `for`, `severity` e anotações (`summary`/`description`).
3. `promtool check rules` valida sem erro.
4. Prometheus carrega as regras e mostra os alertas em `Status > Rules`.
5. Dashboard `Marketplace Overview` contém painel de alertas ativos.
6. Não houve alteração de métricas existentes.
7. Não houve configuração de notificações externas.
8. Não houve mudanças em painéis existentes além da adição do painel de alertas.
