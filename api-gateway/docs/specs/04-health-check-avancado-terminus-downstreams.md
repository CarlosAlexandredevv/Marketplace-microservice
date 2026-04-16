# Spec: health check avançado com Terminus no api-gateway

## Contexto

O `api-gateway` não possui banco de dados próprio, mas depende diretamente da disponibilidade dos 4 serviços downstream:

- `users-service`
- `products-service`
- `checkout-service`
- `payments-service`

O health check atual do gateway é simplificado e não valida o estado desses serviços.

## Fora de escopo

- implementar checks de banco no `api-gateway`;
- readiness/liveness probes;
- alteração das métricas HTTP existentes.

---

## 1. Dependências

1. Instalar `@nestjs/terminus`.
2. Instalar/garantir `@nestjs/axios` para `HttpHealthIndicator`.
3. Versionar dependências no `package.json` e lockfile.

---

## 2. Criar `HealthModule`

Criar `src/health/` contendo:

### 2.1 `HealthController`

- Expor `GET /health`.
- Implementar com `@HealthCheck()`.
- Retornar estrutura padrão Terminus.

### 2.2 Checks downstream via HTTP

Usar `HttpHealthIndicator` para verificar os 4 serviços:

1. `users-service`
2. `products-service`
3. `checkout-service`
4. `payments-service`

Diretrizes:

- cada check deve chamar endpoint de health do respectivo serviço (`/health`);
- utilizar timeout explícito para evitar travamento do endpoint agregado;
- nomear checks com baixa ambiguidade (`users`, `products`, `checkout`, `payments`).

### 2.3 Semântica de retorno

- `200` quando os 4 downstreams estiverem saudáveis;
- `503` quando qualquer downstream estiver indisponível/degradado.

---

## 3. Segurança e acesso

1. Garantir que `GET /health` do gateway seja acessível para monitoramento.
2. Não alterar o modelo de autenticação das rotas de negócio.

---

## 4. Configuração por ambiente

1. Base URLs dos downstreams devem vir de configuração (env/config service).
2. Não hardcodar URLs no controller.
3. Permitir ajuste de timeout por configuração.

---

## 5. Plano de testes

1. Todos os downstreams ativos: `GET /health` retorna `200`.
2. Derrubar um downstream por vez e validar `503` com detalhe do serviço em falha.
3. Reativar downstream e validar recuperação para `200`.
4. Validar timeout e resposta consistente quando um downstream não responde.

---

## 6. Critérios de aceite (claros e testáveis)

1. `@nestjs/terminus` e `@nestjs/axios` estão disponíveis no `api-gateway`.
2. Existe `HealthModule` e `HealthController` em `src/health/`.
3. `GET /health` utiliza `@HealthCheck()`.
4. Existem 4 checks HTTP via `HttpHealthIndicator` para os serviços downstream.
5. Não existe check de banco no gateway.
6. O endpoint retorna `200` apenas quando os 4 downstreams estão `up`.
7. O endpoint retorna `503` quando qualquer downstream está indisponível.
8. Não há readiness/liveness probes implementados.
