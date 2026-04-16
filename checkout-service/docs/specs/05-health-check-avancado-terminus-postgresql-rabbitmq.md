# Spec: health check avançado com Terminus no checkout-service

## Contexto

O `checkout-service` depende de PostgreSQL e RabbitMQ para concluir pedidos e publicar eventos. O health check atual não valida essas dependências, o que dificulta diagnóstico rápido de falhas reais.

Esta spec define health check avançado com `@nestjs/terminus`, cobrindo banco e broker de mensageria.

## Fora de escopo

- readiness/liveness probes de Kubernetes;
- alteração de métricas HTTP existentes;
- configuração de notificações externas de alertas.

---

## 1. Dependências

1. Instalar `@nestjs/terminus`.
2. Garantir presença de `@nestjs/microservices` para checagem de transporte (quando aplicável).
3. Versionar dependências no `package.json` e lockfile.

---

## 2. Criar `HealthModule`

Criar `src/health/` com:

### 2.1 `HealthController`

- Expor `GET /health`.
- Aplicar `@HealthCheck()`.
- Retornar contrato Terminus com `status`, `info`, `error`, `details`.

### 2.2 Checks obrigatórios

1. `TypeOrmHealthIndicator` para PostgreSQL (`postgres`).
2. `MicroserviceHealthIndicator` para RabbitMQ (`rabbitmq`) usando as mesmas configurações de conexão do serviço.

### 2.3 Resultado agregado

- HTTP `200` somente se **ambos** (`postgres` e `rabbitmq`) estiverem `up`.
- HTTP `503` se qualquer dependência estiver `down`.

---

## 3. Reuso de configuração existente

1. Reutilizar host, porta, vhost, usuário e senha de RabbitMQ já usados no serviço.
2. Evitar duplicação de configuração hardcoded no controller.
3. Preferir provider/factory centralizado para options de health.

---

## 4. Registro no `AppModule`

1. Importar `HealthModule` no módulo raiz.
2. Garantir que a rota de health permaneça acessível para monitoramento interno.

---

## 5. Testes de validação

1. PostgreSQL e RabbitMQ ativos: `GET /health` retorna `200`.
2. PostgreSQL indisponível: `GET /health` retorna `503` com `postgres: down`.
3. RabbitMQ indisponível: `GET /health` retorna `503` com `rabbitmq: down`.
4. Ambas dependências indisponíveis: retorno `503` com ambas em `down`.

---

## 6. Critérios de aceite (claros e testáveis)

1. `@nestjs/terminus` está instalado no `checkout-service`.
2. Existe `HealthModule`/`HealthController` em `src/health/`.
3. `GET /health` utiliza `@HealthCheck()`.
4. Há check `postgres` via `TypeOrmHealthIndicator`.
5. Há check `rabbitmq` via `MicroserviceHealthIndicator`.
6. O endpoint retorna `200` somente quando banco e broker estão saudáveis.
7. O endpoint retorna `503` quando qualquer dependência está indisponível.
8. Não há readiness/liveness probes implementados.
