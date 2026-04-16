# Spec: health check avançado com Terminus no users-service

## Contexto

Atualmente o `users-service` expõe apenas um endpoint simples de saúde (`{ status: "ok" }`) sem validar dependências reais.

Para tornar a observabilidade operacional confiável no `marketplace-ms`, o serviço deve adotar `@nestjs/terminus` com validação ativa do PostgreSQL (TypeORM), mantendo compatibilidade com o modelo de métricas já existente.

## Fora de escopo

- readiness/liveness probes de Kubernetes;
- notificações externas de alerta (Slack, e-mail, PagerDuty);
- mudanças em métricas HTTP existentes.

---

## 1. Dependências

1. Instalar `@nestjs/terminus` no `users-service`.
2. Garantir que `@nestjs/axios` esteja disponível para recursos de health check HTTP quando necessário.
3. Versionar alterações no `package.json` e lockfile.

---

## 2. Criar `HealthModule`

Criar `src/health/` contendo:

### 2.1 `HealthController`

- Expor `GET /health`.
- Implementar endpoint com `@HealthCheck()`.
- Retornar payload padrão do Terminus (`status`, `info`, `error`, `details`) para facilitar leitura por operadores e automações.

### 2.2 Indicador obrigatório

- `TypeOrmHealthIndicator` validando conectividade com PostgreSQL.
- Nome sugerido do check: `postgres`.

### 2.3 Comportamento esperado

1. Se banco estiver disponível: retorno `200` com `status: "ok"` e detalhe de `postgres` como `up`.
2. Se banco estiver indisponível: retorno `503` com `status: "error"` e detalhe de `postgres` como `down`.

---

## 3. Integração no `AppModule`

1. Registrar `HealthModule` no `AppModule`.
2. Garantir que a rota `GET /health` não quebre o comportamento atual dos guards globais do serviço.

---

## 4. Contrato mínimo do endpoint

Resposta esperada (estrutura):

- `status`: estado consolidado (`ok` ou `error`);
- `info`: checks saudáveis;
- `error`: checks com falha;
- `details`: consolidado completo por check.

---

## 5. Plano de testes

1. Subir o serviço com PostgreSQL operacional e validar `GET /health` com `200`.
2. Interromper conexão com banco (ou usar credencial inválida) e validar `GET /health` com `503`.
3. Restaurar banco e validar retorno para `200` sem reinício manual adicional do endpoint.

---

## 6. Critérios de aceite (claros e testáveis)

1. `@nestjs/terminus` está instalado no `users-service`.
2. Existe `HealthModule` com `HealthController` em `src/health/`.
3. `GET /health` usa `@HealthCheck()` e `TypeOrmHealthIndicator`.
4. O check `postgres` responde `up` quando o banco está disponível.
5. O endpoint retorna `503` quando o PostgreSQL está indisponível.
6. Não há implementação de readiness/liveness probe.
7. Não há alteração das métricas HTTP já existentes.
