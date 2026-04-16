# Spec: infraestrutura de observabilidade (Prometheus + Grafana)

## Contexto

O projeto `marketplace-ms` possui 5 serviços NestJS:

- `api-gateway` (porta `3005`)
- `users-service` (porta `3000`)
- `products-service` (porta `3001`)
- `checkout-service` (porta `3003`)
- `payments-service` (porta `3004`)

Além disso, existe o `messaging-service` (RabbitMQ) com Docker Compose dedicado em `messaging-service/`.

Precisamos adicionar uma **stack de observabilidade** seguindo o mesmo padrão (pasta dedicada com Docker Compose), composta apenas por:

- **Prometheus** (coleta de métricas) na porta `9090`
- **Grafana** (dashboards) na porta `3010` (evitar conflito com `users-service`)

O Prometheus deve conseguir coletar métricas de serviços rodando no host via `host.docker.internal` e o Grafana deve subir com datasource do Prometheus **pré-configurado via provisioning**.

## Fora de escopo

- Instrumentar os serviços NestJS para exporem métricas (será feito em spec futura).
- Criar dashboards no Grafana (spec futura).
- Configurar alerting/alertmanager (spec futura).
- Adicionar Loki, Jaeger, Tempo, OpenTelemetry Collector ou qualquer outra ferramenta além de Prometheus e Grafana.

---

## 1. Estrutura de pastas da `observability-stack`

Criar a seguinte estrutura na raiz do repositório:

```text
observability-stack/
  docker-compose.yml
  README.md
  prometheus/
    prometheus.yml
  grafana/
    provisioning/
      datasources/
        datasource.yml
```

Requisitos:

- A stack deve ser **auto-contida** em `observability-stack/`, assim como `messaging-service/`.
- Os arquivos de configuração devem estar versionados (sem depender de configuração manual pós-start).

---

## 2. Docker Compose com Prometheus + Grafana

Criar `observability-stack/docker-compose.yml` com os serviços:

1. **Prometheus**
   - Porta exposta: `9090:9090`
   - Montar `./prometheus/prometheus.yml` em `/etc/prometheus/prometheus.yml` (somente leitura)
   - Persistir dados em volume nomeado (`prometheus_data`)
   - Garantir acesso ao host via `host.docker.internal` (incluir `extra_hosts` com `host-gateway`)

2. **Grafana**
   - Porta exposta: `3010:3000`
   - Montar provisioning em `./grafana/provisioning` → `/etc/grafana/provisioning` (somente leitura)
   - Persistir dados em volume nomeado (`grafana_data`)
   - Subir dependente do Prometheus (`depends_on`)

---

## 3. `prometheus.yml` com `scrape_configs` para os 5 serviços

Criar `observability-stack/prometheus/prometheus.yml` com `scrape_configs` usando:

- `host.docker.internal:<porta>` como target
- `metrics_path: /metrics`
- Um `job_name` por serviço:
  - `api-gateway` → `host.docker.internal:3005`
  - `users-service` → `host.docker.internal:3000`
  - `products-service` → `host.docker.internal:3001`
  - `checkout-service` → `host.docker.internal:3003`
  - `payments-service` → `host.docker.internal:3004`

Observação:

- Mesmo que os serviços ainda não exponham `/metrics` nesta etapa, a configuração deve estar pronta para quando a instrumentação for adicionada na próxima spec.

---

## 4. Provisioning do Grafana com datasource Prometheus pré-configurado

Criar provisioning do datasource em:

- `observability-stack/grafana/provisioning/datasources/datasource.yml`

Requisitos:

- O datasource deve se chamar **Prometheus**
- Deve ser `isDefault: true`
- Deve apontar para `http://prometheus:9090` (rede interna do compose)
- Deve iniciar automaticamente sem ações manuais na UI

---

## 5. Mapa de portas atualizado

Mapa de portas do ambiente local (após esta spec):

- **3000**: `users-service`
- **3001**: `products-service`
- **3003**: `checkout-service`
- **3004**: `payments-service`
- **3005**: `api-gateway`
- **5672**: RabbitMQ (`messaging-service`)
- **15672**: RabbitMQ Management UI (`messaging-service`)
- **9090**: Prometheus (`observability-stack`)
- **3010**: Grafana (`observability-stack`)

---

## 6. README básico

Criar `observability-stack/README.md` com instruções mínimas:

- Como subir a stack (`docker-compose up -d`)
- URLs de acesso:
  - Prometheus `http://localhost:9090`
  - Grafana `http://localhost:3010`
- Informar que o Grafana já sobe com datasource do Prometheus provisionado
- Como parar/remover volumes (`docker-compose down -v`)

---

## 7. Critérios de aceite (claros e testáveis)

1. **Estrutura e arquivos**
   - Existe a pasta `observability-stack/` na raiz do repositório.
   - Existem os arquivos:
     - `observability-stack/docker-compose.yml`
     - `observability-stack/prometheus/prometheus.yml`
     - `observability-stack/grafana/provisioning/datasources/datasource.yml`
     - `observability-stack/README.md`

2. **Prometheus operacional**
   - Ao executar `docker-compose up -d` dentro de `observability-stack/`, o container `marketplace-prometheus` inicia sem erro.
   - O Prometheus fica acessível em `http://localhost:9090`.

3. **Grafana operacional com datasource provisionado**
   - Ao executar `docker-compose up -d` dentro de `observability-stack/`, o container `marketplace-grafana` inicia sem erro.
   - O Grafana fica acessível em `http://localhost:3010`.
   - Ao logar no Grafana, o datasource **Prometheus** já existe e está configurado apontando para `http://prometheus:9090`.

4. **Scrape configs prontos para os 5 serviços**
   - O arquivo `observability-stack/prometheus/prometheus.yml` contém 5 `scrape_configs`, um para cada serviço listado no contexto, todos usando `host.docker.internal` e `metrics_path: /metrics`.

