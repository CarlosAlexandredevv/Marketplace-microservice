# Spec: refatoração de auth — repositórios e utilitários de senha

## Contexto

O **users-service** já implementa **`POST /auth/register`** e **`POST /auth/login`** com JWT, conforme as especificações **02-auth-register** e **03-auth-login-jwt**. A persistência de usuários hoje concentra o acesso ao TypeORM no **`UsersService`**, e funções de **hash** e **comparação** de senha aparecem junto à lógica de autenticação.

Esta especificação define uma **refatoração estrutural** do projeto: introdução de uma camada de **repositórios** e extração de operações criptográficas de senha para **utilitários reutilizáveis**, **sem** alterar o contrato HTTP nem o comportamento observável já acordado nas specs anteriores.

**Fora de escopo desta spec:** novos endpoints, mudança de payload JWT, alteração de mensagens de erro, mudança de regras de validação de DTOs, proteção de rotas com guards, refresh tokens, e qualquer evolução funcional além da reorganização interna descrita abaixo.

---

## 1. Requisitos funcionais (comportamento preservado)

1. **Paridade com as specs de registro e login**  
   Após a refatoração, o serviço deve manter o mesmo comportamento descrito em **02-auth-register** e **03-auth-login-jwt**: mesmos códigos HTTP, mesmas mensagens de erro nos cenários documentados, mesma forma de normalização de e-mail, mesma política de unicidade de e-mail, mesmo formato de resposta de sucesso (incluindo ausência de `password` na representação pública do usuário), e mesmo conteúdo conceitual do payload JWT (claims `sub`, `email`, `role` e tempo de vida de **24 horas**).

2. **Critério objetivo de regressão**  
   A suíte de testes automatizados existente no repositório (incluindo testes e2e ou de integração que cubram registro e login) deve continuar **passando integralmente**, sem relaxar asserções ou alterar cenários, exceto ajustes estritamente necessários à reorganização de imports ou nomes de módulos — e, nesse caso, o **comportamento testado** deve permanecer o mesmo.

3. **Orquestração de domínio nos serviços**  
   **`AuthService`** e **`UsersService`** (ou equivalentes nomeados no projeto) continuam responsáveis por **orquestrar** regras de negócio (por exemplo: fluxo de registro, fluxo de login, decisão de conflito de e-mail, decisão de credenciais inválidas versus conta inativa, emissão do JWT). A refatoração **não** deve mover regras de negócio para camadas puramente de infraestrutura sem necessidade documentada nesta spec.

---

## 2. Requisitos estruturais — camada de repositório

1. **Separação da persistência**  
   As operações de leitura e escrita do agregado **usuário** no banco (consultas por e-mail, verificação de existência, criação e persistência da entidade) devem ser concentradas em um **repositório de usuários** dedicado, de forma que o **`UsersService`** deixe de injetar diretamente o **`Repository<User>`** do TypeORM como mecanismo principal de acesso aos dados — passando a depender do repositório de domínio/persistência definido pelo projeto.

2. **Contrato do repositório**  
   O repositório deve expor, no mínimo, as capacidades já utilizadas hoje pelos fluxos de registro e login: verificar existência por e-mail já normalizado, buscar usuário por e-mail (incluindo o campo necessário para validação de senha no login), e persistir um novo usuário com os dados exigidos pelo modelo atual. Os **nomes** dos métodos e a **organização em arquivos** ficam a critério da implementação, desde que a responsabilidade fique clara.

3. **Registro no módulo Nest**  
   O repositório deve ser registrado de forma compatível com a injeção de dependências do NestJS (provider exportável/consumível pelo módulo de usuários e, quando aplicável, pelo módulo de autenticação), sem acoplamento indevido do domínio a detalhes de framework além do necessário.

4. **Entidade e mapeamento**  
   A entidade **`User`** e o mapeamento TypeORM permanecem a fonte de verdade do modelo persistido; o repositório opera sobre essa entidade (ou DTOs internos alinhados a ela), sem duplicar regras de unicidade ou formato de colunas em lógica dispersa.

---

## 3. Requisitos estruturais — utilitários de senha

1. **Extração da lógica não pertencente ao domínio de auth**  
   As operações de **gerar hash** a partir de senha em texto plano e de **comparar** senha em texto plano com hash armazenado devem residir em um **módulo utilitário** compartilhado (por exemplo, sob um namespace de `common`, `shared` ou convenção já adotada no projeto), **fora** do corpo principal de **`AuthService`**.

2. **Parâmetros e política**  
   O número de rounds (custo) do algoritmo de hash usado no registro deve permanecer **alinhado ao comportamento atual** em produção/testes (mesmo valor efetivo que já produz os hashes esperados), configurável apenas se o projeto já tiver padrão para isso; esta spec **não** impõe mudança de custo criptográfico.

3. **Segurança operacional**  
   Senhas em texto plano e hashes **não** devem ser logados; utilitários e chamadores mantêm essa invariante.

4. **Reutilização**  
   Tanto o fluxo de **registro** quanto o de **login** (e qualquer outro ponto futuro autorizado pela equipe) devem poder reutilizar os mesmos utilitários, evitando duplicação de wrappers ou callbacks idênticos em múltiplos serviços.

---

## 4. Estrutura de dados e contratos conceituais

### 4.1. Entrada de criação de usuário (persistência)

Conceitualmente, o repositório ou camada equivalente continua a aceitar os mesmos dados necessários para criar um **`User`** hoje: e-mail já normalizado, **hash** da senha (não texto plano no persistido), nome, sobrenome, papel (`role`) e status. Nenhum campo novo é exigido por esta spec.

### 4.2. Resultado de consulta por e-mail

A busca por e-mail normalizado deve continuar a retornar, quando existir, a entidade (ou projeção interna) que permita: comparar senha com o hash, avaliar **`status`**, e montar a representação pública **sem** `password` na resposta da API.

### 4.3. DTOs e respostas HTTP

Os DTOs de **register**, **login** e os formatos JSON de sucesso e erro **não** mudam em relação às specs **02** e **03**, salvo renomeações puramente internas que não afetem o contrato exposto.

### 4.4. Payload JWT

Permanece conforme **03-auth-login-jwt**: claims `sub` (UUID), `email`, `role`, expiração de **24 horas**, segredo via **`JWT_SECRET`**.

---

## 5. Critérios de aceite (testáveis)

1. Todos os testes automatizados existentes para registro e login passam **sem** alteração de expectativa de comportamento.

2. **`POST /auth/register`** e **`POST /auth/login`** respondem como antes nos cenários de sucesso e erro documentados em **02** e **03**.

3. O acesso direto ao **`Repository<User>`** no **`UsersService`** foi substituído pelo uso do **repositório de usuários** definido nesta spec (ou justificativa documentada em PR se houver exceção pontual aprovada pela equipe).

4. Funções de hash e comparação de senha **não** permanecem definidas como detalhe interno exclusivo de **`AuthService`**; residem em utilitário(s) reutilizável(is).

5. Não há vazamento de `password` ou hash em respostas JSON dos endpoints de auth.

---

## 6. Rastreabilidade

- **Altera a implementação interna de:** fluxos já especificados em **02-auth-register** e **03-auth-login-jwt**.
- **Não substitui** as specs 02 e 03: elas continuam a definir o **contrato** e o **comportamento**; esta spec define **reorganização do código** para manter esse contrato com melhor separação de responsabilidades.

---

## 7. Ordem sugerida de trabalho (planejamento, sem prescrever implementação)

1. Introduzir o repositório de usuários e migrar chamadas do **`UsersService`** mantendo testes verdes.
2. Extrair utilitários de senha e atualizar **`AuthService`** (e demais consumidores) mantendo testes verdes.
3. Revisão final de limites de módulo (exports/imports) e duplicação removida.
