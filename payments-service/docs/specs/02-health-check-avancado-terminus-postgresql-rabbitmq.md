# Spec: health check avançado com Terminus no payments-service

## Contexto

O `payments-service` processa pagamentos com dependência de PostgreSQL e RabbitMQ. O endpoint atual de saúde é superficial e não identifica indisponibilidade de dependências.

Esta spec define health check real com `@nestjs/terminus` para suportar operação, diagnóstico e alerting confiáveis.

## Fora de escopo

- readiness/liveness probes;
- notificações de alerta para Slack/e-mail;
- mudanças nas métricas HTTP existentes.

---

## 1. Dependências

1. Instalar `@nestjs/terminus`.
2. Garantir suporte ao `MicroserviceHealthIndicator` para RabbitMQ.
3. Versionar mudanças de dependências.

---

## 2. Criar `HealthModule`

Criar `src/health/` contendo:

### 2.1 `HealthController`

- Expor `GET /health`.
- Implementar com `@HealthCheck()`.
- Retornar estrutura Terminus (`status`, `info`, `error`, `details`).

### 2.2 Checks obrigatórios

1. `TypeOrmHealthIndicator` para PostgreSQL (`postgres`).
2. `MicroserviceHealthIndicator` para RabbitMQ (`rabbitmq`).

### 2.3 Regra de disponibilidade

- `200` quando `postgres` e `rabbitmq` estiverem `up`.
- `503` quando qualquer um estiver `down`.

---

## 3. Diretrizes de implementação

1. Reaproveitar configurações de conexão existentes do TypeORM e RabbitMQ.
2. Evitar endpoint mockado (`{ status: "ok" }`) sem checks reais.
3. Preservar comportamento das demais rotas e guards.

---

## 4. Registro no módulo raiz

1. Importar `HealthModule` no `AppModule`.
2. Garantir endpoint de health disponível para monitoramento interno.

---

## 5. Plano de testes

1. Ambiente íntegro: `GET /health` retorna `200`.
2. Banco fora: `GET /health` retorna `503` com `postgres: down`.
3. RabbitMQ fora: `GET /health` retorna `503` com `rabbitmq: down`.
4. Recuperação de dependências: endpoint volta para `200`.

---

## 6. Critérios de aceite (claros e testáveis)

1. `@nestjs/terminus` está instalado no `payments-service`.
2. Existe `HealthModule` com `HealthController` em `src/health/`.
3. `GET /health` usa `@HealthCheck()`.
4. Há validação de PostgreSQL com `TypeOrmHealthIndicator`.
5. Há validação de RabbitMQ com `MicroserviceHealthIndicator`.
6. O retorno é `200` apenas com ambas dependências saudáveis.
7. O retorno é `503` quando qualquer dependência falha.
8. Não há readiness/liveness probes implementados.
