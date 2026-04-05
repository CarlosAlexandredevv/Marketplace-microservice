# Spec: scaffold do `users-service`

## Contexto

O **users-service** é o microserviço responsável por persistência e gestão de dados de usuários do marketplace. Ele se integra ao ecossistema existente (api-gateway na porta 3005, **products-service** na porta 3001, checkout-service na porta 3003, payments-service na porta 3004, messaging-service com RabbitMQ nas portas 5672/15672), expondo a aplicação na **porta 3000**.

Stack alvo: **NestJS**, **TypeORM**, **PostgreSQL 15**. O banco dedicado ao serviço deve subir via **Docker Compose**, host mapeado na **porta 5433**, base de dados **`users_db`**.

Escopo intencionalmente **enxuto** (projeto de curso): apenas fundação técnica e modelo de dados mínimo. **Não** faz parte desta spec: endpoints HTTP, autenticação, regras de negócio ou integrações com outros serviços — isso será tratado em especificações futuras.

---

## 1. Requisitos funcionais

1. **Projeto NestJS**  
   Manter o serviço como aplicação NestJS alinhada em estilo e scripts aos demais microserviços do repositório (build, start, lint, testes).

2. **Dependências de scaffold**  
   Incluir e declarar as dependências necessárias para: persistência com TypeORM, driver PostgreSQL, carregamento de configuração via ambiente/arquivo e validação de DTOs com `class-validator` (e o que o Nest exigir de forma usual para `ValidationPipe`, sem detalhar implementação aqui).

3. **Docker Compose (PostgreSQL 15)**  
   Fornecer um arquivo Compose que suba **PostgreSQL 15** com volume para dados, rede isolada do serviço (padrão similar aos outros serviços), mapeamento **5433 → 5432** no host, e criação/uso da base **`users_db`** com usuário e senha definíveis de forma coerente com as variáveis de ambiente do aplicativo.

4. **Configuração do banco via ambiente**  
   Toda conexão à base (host, porta, usuário, senha, nome do banco, porta da aplicação) deve ser obtida a partir de variáveis de ambiente documentadas, com valores padrão de desenvolvimento coerentes com o Compose (quando aplicável), sem credenciais fixas em código de produção.

5. **Módulo de usuários (básico)**  
   Existir um **módulo de domínio de usuários** registrado na aplicação, contendo apenas a estrutura mínima de módulo Nest (sem controllers nem rotas nesta fase). A entidade de usuário descrita na seção 2 deve pertencer a esse contexto.

6. **ValidationPipe global**  
   A aplicação deve registrar um **pipe de validação global** na inicialização, de modo que validações baseadas em `class-validator` em DTOs futuros sejam aplicadas de forma consistente em toda a API (quando endpoints forem adicionados).

---

## 2. Estrutura de dados — entidade `User`

Definir uma única entidade de persistência **`User`** com **exatamente** os campos abaixo (sem campos adicionais nesta spec):

| Campo        | Tipo conceitual | Regras |
|-------------|-----------------|--------|
| `id`        | Identificador único universal (UUID) | Gerado automaticamente pelo sistema; imutável. |
| `email`     | Texto           | Obrigatório; **único** no banco. |
| `password`  | Texto           | Armazenar apenas representação **hash** (nunca senha em texto plano). |
| `firstName` | Texto           | Obrigatório para o modelo; comprimento mínimo razoável pode ser definido na implementação. |
| `lastName`  | Texto           | Idem `firstName`. |
| `role`      | Enumeração      | Valores permitidos: **`seller`**, **`buyer`**. |
| `status`    | Enumeração      | Valores permitidos: **`active`**, **`inactive`**; valor padrão ao criar registro: **`active`**. |
| `createdAt` | Data/hora       | Preenchido automaticamente na criação do registro. |
| `updatedAt` | Data/hora       | Atualizado automaticamente quando o registro for modificado. |

**Fora de escopo:** migrações formais vs. `synchronize`, índices extras, soft delete, perfis estendidos — a menos que outra spec determine.

---

## 3. Variáveis de ambiente

O serviço deve documentar e utilizar pelo menos:

| Variável       | Finalidade |
|----------------|------------|
| `PORT`         | Porta HTTP do NestJS (alvo: **3000** em desenvolvimento). |
| `DB_HOST`      | Host do PostgreSQL (ex.: `localhost` com Compose mapeado). |
| `DB_PORT`      | Porta do PostgreSQL **no host** (alvo: **5433** alinhado ao mapeamento do Compose). |
| `DB_USERNAME`  | Usuário da base. |
| `DB_PASSWORD`  | Senha da base. |
| `DB_DATABASE`  | Nome da base (**`users_db`**). |

Variáveis adicionais (ex.: `NODE_ENV`) podem ser usadas para comportamento de desenvolvimento vs. produção, desde que não contradizam esta spec.

---

## 4. Critérios de aceite (testáveis)

1. **`npm install` e `npm run build`** no diretório `users-service` concluem sem erro após o scaffold completo.

2. **Compose:** com `docker compose up` (ou comando equivalente documentado no serviço), o container PostgreSQL 15 sobe, a porta **5433** aceita conexão, e a base **`users_db`** existe e aceita autenticação com as credenciais definidas no Compose / `.env` de exemplo.

3. **Aplicação:** com o banco no ar e variáveis apontando para ele, **`npm run start:dev`** inicia o NestJS na porta definida por `PORT` (**3000** quando `PORT=3000`), conecta ao PostgreSQL sem falha de conexão, e o TypeORM reconhece a entidade `User` (tabela criada ou prevista conforme estratégia escolhida no plano de implementação).

4. **Módulo:** o módulo de usuários está importado no módulo raiz da aplicação; não há necessidade de expor rotas para aceitar este item.

5. **ValidationPipe:** inspecionando o ponto de bootstrap da aplicação, confirma-se o registro **global** do pipe de validação (equivalente funcional ao usado nos outros serviços Nest do repositório).

6. **Entidade:** no esquema físico (ou metadados TypeORM), a tabela de usuários contém colunas correspondentes a todos os campos da seção 2, com unicidade de `email`, default de `status` = `active`, e timestamps de criação/atualização automáticos.

7. **Escopo negativo verificado:** não há controllers de usuário com rotas públicas documentadas nesta fase; não há fluxo de login, JWT ou integração com api-gateway exigida por esta spec.

---

## 5. Referência de posicionamento no ecossistema

| Componente            | Porta / recurso        |
|-----------------------|------------------------|
| users-service (HTTP)  | 3000                   |
| products-service (HTTP) | 3001                 |
| checkout-service (HTTP) | 3003                 |
| payments-service (HTTP) | 3004                 |
| api-gateway (HTTP)    | 3005                   |
| PostgreSQL users (host) | 5433 → `users_db`    |
| PostgreSQL checkout (host) | 5434 → `checkout_db` |
| PostgreSQL payments (host) | 5435 → `payments_db` |
| PostgreSQL products (host) | 5436 → `products_db` |
| RabbitMQ AMQP         | 5672                   |
| RabbitMQ Management   | 15672                  |

Futuras specs podem detalhar roteamento no gateway e contratos de API. Variável **`PAYMENTS_SERVICE_URL`** (e legado **`PAYMENT_SERVICE_URL`**) no gateway deve apontar para o payments-service na porta **3004**.

## 6. Commits

Faça sempre um commit após cada implementação dessa speec e futuras (Caso os testes passem).