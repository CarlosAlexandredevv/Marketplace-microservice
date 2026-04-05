# Spec: Scaffold do products-service

Documento de requisitos para o esqueleto inicial do **products-service** no monorepo **marketplace-ms**. Descreve apenas **o que** deve existir, não **como** implementar. Endpoints de catálogo, autenticação e regras de negócio ficam para especificações posteriores.

## Contexto

- Serviço responsável pelo catálogo de produtos do marketplace.
- Porta HTTP padrão do serviço: **3001**.
- Stack alvo: **NestJS**, **TypeORM**, **PostgreSQL 15**.
- Escopo de curso: implementação enxuta, somente o necessário para subir o serviço com banco isolado e base de dados modelada.

## 1. Requisitos funcionais

1. **Projeto NestJS**  
   Criar o microserviço como aplicação NestJS alinhada aos demais serviços do repositório (estrutura, scripts e convenções semelhantes ao **users-service**).

2. **Dependências**  
   Incluir as bibliotecas necessárias para: persistência com TypeORM, driver PostgreSQL, carregamento de configuração a partir de ambiente/arquivo, e validação de DTOs (incluindo o que o ecossistema Nest costuma exigir em conjunto com `class-validator`).

3. **Docker Compose**  
   Definir um serviço de banco **PostgreSQL 15** dedicado ao products-service, com volume para dados e rede interna do compose. O banco lógico deve ser **`products_db`**. A porta **5434** no host deve mapear para a porta padrão do PostgreSQL no container (conforme convenção da aula).

4. **Configuração do banco**  
   Toda conexão (host, porta, credenciais, nome do banco) deve ser obtida por **variáveis de ambiente**, com valores de exemplo documentados para desenvolvimento local.

5. **Módulo de produtos**  
   Existir um módulo de domínio **produtos** registrado na aplicação, contendo a entidade de produto e o registro no TypeORM para uso futuro. **Não** incluir controllers nem rotas de API de produtos nesta spec.

6. **ValidationPipe global**  
   A aplicação deve registrar um pipe de validação **global**, habilitando transformação e lista branca de propriedades de DTOs, de forma consistente com o padrão adotado no **users-service** (mensagens de erro de validação tratadas de forma uniforme).

## 2. Estrutura de dados — entidade Product

Persistir uma entidade **Product** com **exatamente** os campos abaixo (sem relacionamento de banco com o serviço de usuários: `sellerId` é apenas identificador lógico).

| Campo        | Tipo / restrições |
|-------------|-------------------|
| id          | UUID, gerado automaticamente |
| name        | Texto, até 255 caracteres |
| description | Texto longo |
| price       | Decimal com precisão (10,2) |
| stock       | Inteiro, valor padrão 0 |
| sellerId    | UUID do vendedor (sem FK física; banco do usuário é outro serviço) |
| isActive    | Booleano, padrão verdadeiro |
| createdAt   | Data/hora de criação, preenchida automaticamente |
| updatedAt   | Data/hora de última atualização, preenchida automaticamente |

Nenhum outro campo obrigatório nesta fase.

## 3. Variáveis de ambiente

Documentar e utilizar pelo menos:

- `PORT` — porta HTTP do serviço.
- `DB_HOST` — host do PostgreSQL.
- `DB_PORT` — porta do PostgreSQL (lado cliente).
- `DB_USERNAME` — usuário do banco.
- `DB_PASSWORD` — senha do banco.
- `DB_DATABASE` — nome do banco (deve refletir `products_db` em desenvolvimento).

Opcionalmente pode existir `NODE_ENV` para distinguir desenvolvimento e produção (por exemplo, sincronização de schema e logging), como nos outros serviços.

## 4. Critérios de aceite

Os itens abaixo devem poder ser verificados de forma objetiva:

1. O diretório do **products-service** existe no monorepo com projeto NestJS gerado de forma reproduzível (por exemplo, via Nest CLI) e scripts de build/execução funcionais.
2. As dependências citadas na seção 1 estão declaradas e o projeto compila sem erros.
3. Com `docker compose` do serviço, o PostgreSQL 15 sobe, o banco `products_db` está disponível e a porta **5434** no host aceita conexão quando mapeada conforme a spec.
4. Com um arquivo de ambiente preenchido a partir do exemplo, a aplicação inicia na porta configurada (**3001** por padrão) e conecta ao banco usando somente variáveis de ambiente.
5. O módulo de produtos está importado na aplicação; a entidade **Product** está mapeada para o TypeORM e a tabela correspondente é criada/atualizada em ambiente de desenvolvimento conforme a política já usada nos outros serviços (sem exigir migrações manuais nesta spec).
6. O **ValidationPipe** global está ativo; requisições futuras com DTOs inválidos serão rejeitadas com erro de validação padronizado.
7. Não há rotas REST de catálogo (CRUD de produtos) nem autenticação específica de produtos nesta entrega — apenas o esqueleto descrito.

## 5. Fora de escopo (explícito)

- Endpoints HTTP de produtos.
- Autenticação/autorização.
- Integração com API Gateway, filas ou outros microserviços.
- Testes automatizados além do que o scaffold Nest já trouxer por padrão.
- Migrações versionadas em produção (pode ser tratado em spec futura).

---

*Esta spec fecha o escopo do scaffold da aula; o plano de implementação detalhado pode referenciar cada seção e critério acima.*
