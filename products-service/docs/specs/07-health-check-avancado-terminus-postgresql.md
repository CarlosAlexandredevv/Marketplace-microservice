# Spec: health check avançado com Terminus no products-service

## Contexto

O `products-service` atualmente responde saúde com payload estático e não valida a disponibilidade real do PostgreSQL.

Para melhorar a confiabilidade operacional do `marketplace-ms`, o serviço deve migrar para `@nestjs/terminus` e validar a dependência de banco via `TypeOrmHealthIndicator`.

## Fora de escopo

- readiness/liveness probes;
- integração com canais externos de notificação;
- alterações em dashboards existentes (além do painel de alertas definido em spec própria).

---

## 1. Dependências

1. Instalar `@nestjs/terminus`.
2. Garantir compatibilidade com o stack atual de TypeORM.
3. Versionar lockfile e `package.json`.

---

## 2. Criar `HealthModule`

Criar pasta `src/health/` com:

### 2.1 `HealthController`

- Rota `GET /health`.
- Uso de `@HealthCheck()`.
- Resposta padrão Terminus com `status`, `info`, `error`, `details`.

### 2.2 Check obrigatório

- `TypeOrmHealthIndicator` para verificar conectividade com PostgreSQL.
- Nome do check: `postgres`.

### 2.3 Regras de retorno

1. Banco saudável: HTTP `200`.
2. Banco indisponível: HTTP `503`.

---

## 3. Registro no módulo principal

1. Importar `HealthModule` no `AppModule`.
2. Garantir que `GET /health` mantenha o padrão de segurança já adotado pelo serviço sem regressão.

---

## 4. Testes de validação

1. Com banco disponível, validar `GET /health` retornando `200` e `postgres: up`.
2. Simular indisponibilidade do banco e validar `503` com `postgres: down`.
3. Recuperar banco e confirmar normalização da saúde para `200`.

---

## 5. Critérios de aceite (claros e testáveis)

1. `@nestjs/terminus` está instalado no `products-service`.
2. Existe `HealthModule` e `HealthController` em `src/health/`.
3. `GET /health` está implementado com `@HealthCheck()`.
4. Existe check `postgres` com `TypeOrmHealthIndicator`.
5. O endpoint retorna `200` quando PostgreSQL está disponível.
6. O endpoint retorna `503` quando PostgreSQL está indisponível.
7. Não há implementação de readiness/liveness probes.
