# Spec: Entidades de domínio (TypeORM) e autenticação JWT no checkout-service

| Campo | Valor |
|--------|--------|
| Serviço | checkout-service (porta 3003) |
| Banco | PostgreSQL (porta 5436, base conforme configuração existente) |
| Estado atual | NestJS com TypeORM e RabbitMQ (`EventsModule`); sem entidades que gerem tabelas; sem JWT |

## Objetivo

Introduzir o modelo de dados inicial do checkout (carrinho, itens e pedido) via entidades TypeORM, alinhar a segurança ao padrão já adotado no **products-service** (módulo de autenticação JWT, guard global e rota pública explícita), expor um health check público, documentar a API de forma básica no bootstrap da aplicação e integrar os novos módulos no `AppModule` **sem** alterar o `EventsModule` existente.

## Referências obrigatórias

- **users-service (porta 3000):** emite JWT cujo payload inclui identificador do usuário (`sub`, UUID), e-mail (`email`) e papel (`role`, valores `seller` ou `buyer`). O checkout deve aceitar tokens válidos gerados por esse serviço.
- **products-service:** replicar a **abordagem** de autenticação: módulo dedicado (`AuthModule`), estratégia JWT (`JwtStrategy`), guard de autenticação aplicado globalmente (`APP_GUARD` com `JwtAuthGuard`) e decorator de exclusão (`@Public()`). O segredo de assinatura deve ser o **mesmo** `JWT_SECRET` configurado no users-service (variável de ambiente já prevista no `.env.example` do checkout).

## Fora de escopo (explícito)

- Endpoints CRUD ou de negócio para carrinho, itens ou pedidos (ficam para specs futuras).
- Qualquer alteração em filas, exchanges, consumidores ou serviços do **EventsModule** / RabbitMQ.
- Implementação neste documento: apenas descrição do **o quê** entregar; o **como** fica para o plano de implementação.

---

## 1. Entidades TypeORM

Criar três entidades registradas no padrão de descoberta já usado pela configuração do TypeORM do serviço (caminho de entidades existente), de forma que, em ambiente de desenvolvimento com sincronização habilitada, as tabelas correspondentes sejam criadas.

### 1.1 Cart (carrinho)

- Identificador primário: UUID.
- `userId`: UUID (referência lógica ao usuário; sem FK obrigatória para outro serviço nesta spec).
- `status`: enum com valores `active`, `completed`, `abandoned`; valor padrão `active`.
- `total`: decimal com precisão monetária (10 dígitos totais, 2 decimais); padrão `0`.
- Relação **um-para-muitos** com `CartItem`: mapeamento `items`; ao persistir o carrinho, operações em itens filhos devem propagar conforme cascade definido para essa relação; carregamento **eager** dos itens quando a entidade `Cart` for carregada (conforme solicitado).
- `createdAt` e `updatedAt`: auditoria de criação e atualização.

### 1.2 CartItem (item do carrinho)

- Identificador primário: UUID.
- Relação **muitos-para-um** com `Cart`; ao remover o carrinho pai, itens devem ser removidos (comportamento de exclusão em cascata no banco, conforme `onDelete` indicado).
- Coluna `cartId`: UUID, alinhada à FK da relação com `Cart`.
- `productId`: UUID (referência lógica ao produto em outro serviço).
- `productName`: texto até 255 caracteres.
- `price`: decimal (10,2).
- `quantity`: inteiro, padrão `1`.
- `subtotal`: decimal (10,2).
- `createdAt`: data de criação (sem `updatedAt` nesta spec).

### 1.3 Order (pedido)

- Identificador primário: UUID.
- `userId`: UUID.
- `cartId`: UUID (associação ao carrinho de origem; sem impor FK física a `Cart` nesta spec, salvo se a implementação optar por FK — o mínimo é persistir o identificador).
- `total`: decimal (10,2).
- `status`: enum `pending`, `paid`, `failed`, `cancelled`; padrão `pending`.
- `paymentMethod`: texto até 50 caracteres.
- `createdAt` e `updatedAt`.

**Nota de modelagem:** nomes de tabelas e colunas devem seguir convenções consistentes com o restante do monorepo (snake_case no banco se for o padrão adotado no projeto).

---

## 2. Módulos de domínio

### 2.1 CartModule

- Declarar o módulo do carrinho.
- Registrar as entidades `Cart` e `CartItem` via `TypeOrmModule.forFeature([...])` neste módulo.
- **Não** expor controllers de API além do que esta spec pede explicitamente (nenhum CRUD).

### 2.2 OrdersModule

- Declarar o módulo de pedidos.
- Registrar a entidade `Order` via `TypeOrmModule.forFeature([...])`.
- **Não** expor controllers de API além do que esta spec pede explicitamente (nenhum CRUD).

---

## 3. Autenticação JWT (padrão products-service)

### 3.1 AuthModule

- Módulo que configura Passport com estratégia JWT padrão e o módulo JWT do Nest, obtendo o segredo a partir de `ConfigService` / variável de ambiente `JWT_SECRET`.
- Falha de configuração: se o segredo estiver ausente ou vazio, a aplicação deve falhar de forma explícita na inicialização (mesma filosofia do products-service).
- Exportar o que for necessário para o restante da aplicação usar o guard e o módulo JWT (espelhando o products-service).

### 3.2 JwtStrategy

- Validar o token com o **mesmo** `JWT_SECRET` usado pelo users-service.
- Extrair e expor no objeto de requisição o payload compatível com `{ sub, email, role }` para uso futuro em handlers (sem exigir endpoints nesta spec).

### 3.3 JwtAuthGuard global

- Registrar `JwtAuthGuard` como guard de aplicação (`APP_GUARD`) no `AppModule`, de modo que **todas** as rotas exijam JWT por padrão.

### 3.4 Decorator `@Public()`

- Implementar decorator de metadados que marca rotas (ou controladores inteiros, conforme padrão do products-service) como isentas do guard JWT.
- Documentar na implementação quais rotas devem ser públicas nesta spec (ver seção 4).

**Observação:** guards adicionais por papel (ex.: vendedor) não são exigidos nesta spec; apenas autenticação JWT e rota pública.

---

## 4. Health check público

- Expor **GET** `/health` sem exigência de JWT (marcada como pública).
- Corpo JSON de resposta: objeto com `status` igual à string `ok` e `service` igual à string `checkout-service`.
- Código HTTP de sucesso adequado (2xx) quando o processo está saudável.

---

## 5. Swagger básico

- No arquivo de bootstrap da aplicação (`main.ts`), configurar o Swagger de forma **básica**: título e descrição identificando o checkout-service, versão, e prefixo/base coerente com a API (conforme convenção do projeto).
- Não é necessário documentar DTOs de domínio nesta fase além do mínimo para o health (se aplicável).

---

## 6. AppModule

- Importar `AuthModule`, `CartModule` e `OrdersModule` junto aos imports já existentes (`ConfigModule`, `TypeOrmModule.forRoot`, `EventsModule`).
- Manter **EventsModule** inalterado em comportamento e responsabilidades.
- Registrar o provider global do `JwtAuthGuard` conforme seção 3.3.
- Garantir que nenhum controller existente que deva permanecer público fique inadvertidamente protegido sem `@Public()` (avaliar `AppController` atual e ajustar conforme necessário).

---

## 7. Variáveis de ambiente

- Garantir que `JWT_SECRET` esteja documentada e alinhada ao users-service (já presente no `.env.example` do checkout: revisar descrição/comentários se necessário para deixar explícita a obrigatoriedade de coincidir com o users-service).

---

## 8. Critérios de aceite (testáveis)

1. **Tabelas:** Com o banco configurado e sincronização de schema permitida em desenvolvimento, após subir o serviço existem tabelas correspondentes a `Cart`, `CartItem` e `Order` com colunas e tipos compatíveis com a seção 1 (incluindo defaults e enums definidos).
2. **Relações:** Um `Cart` persistido com itens associados pode ser recarregado com a coleção `items` disponível sem consulta manual adicional (eager conforme spec); exclusão do carrinho remove itens dependentes no banco (cascata).
3. **JWT:** Uma requisição com header `Authorization: Bearer <token>` válido emitido pelo users-service é aceita em uma rota protegida de teste mínima (por exemplo, um endpoint temporário ou existente protegido) — **ou**, na ausência de rota de negócio, validação equivalente via teste automatizado que monte o app e use `JwtService`/estratégia; o critério mínimo é: token válido não retorna 401 por autenticação.
4. **JWT inválido:** Token ausente, malformado ou com assinatura incorreta em rota protegida resulta em negação de acesso (401 ou equivalente do guard).
5. **Health público:** `GET /health` sem token retorna JSON com exatamente as chaves e valores string especificados (`status`, `service`) e não retorna 401.
6. **Swagger:** Em execução local, a UI ou o JSON do Swagger fica acessível no caminho padrão configurado no Nest e lista a documentação básica do serviço.
7. **EventsModule:** Nenhuma mudança de comportamento nos fluxos RabbitMQ existentes (mesmos módulos, filas e integrações que antes da implementação).
8. **Escopo de API:** Não existem endpoints REST de CRUD para carrinho, itens ou pedidos além do health (e eventual rota de app existente ajustada para público/privado).

---

## 9. Entregáveis da implementação (resumo)

- Entidades e módulos descritos, `AppModule` atualizado, auth global com `@Public()` no health (e onde mais for necessário), Swagger básico no bootstrap, documentação de ambiente coerente com `JWT_SECRET` compartilhado.
- Testes automatizados: recomendados para health público e para o guard JWT em pelo menos um caso positivo e um negativo; não obrigatório detalhar nesta spec o framework de teste.

---

*Documento de especificação — implementação delegada a plano subsequente.*
