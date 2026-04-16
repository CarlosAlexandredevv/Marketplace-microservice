 # Spec: integração do payments-service no api-gateway

 ## Contexto

 O `payments-service` (porta `3004`) já está funcional e expõe:

 - entidade de domínio `Payment`;
 - `FakePaymentGatewayService` simulando integração externa;
 - consumer assíncrono que processa pagamentos a partir das mensagens do RabbitMQ;
 - endpoint `GET /payments/:orderId` para consulta de pagamento por pedido;
 - health check próprio.

 O `api-gateway` (porta `3005`) já possui:

 - infraestrutura de proxy reutilizável (`ProxyModule`, `ProxyService`, etc.);
 - integração com `users-service`, `products-service` e `checkout-service`;
 - módulo de autenticação com JWT e guard global;
 - configuração do serviço de pagamentos em `gateway.config.ts` como `payments` (`url: http://localhost:3004`, `timeout: 10000`).

 Todos os serviços do marketplace estão funcionais:

 - `users-service` (3000)
 - `products-service` (3001)
 - `checkout-service` (3003)
 - `payments-service` (3004)
 - `RabbitMQ` (5672)

 Esta spec descreve a exposição do `payments-service` via `api-gateway` e o fluxo E2E completo do marketplace passando exclusivamente pelo gateway.

 **Fora de escopo desta spec:**

 - alterar o comportamento interno do `payments-service`;
 - alterar o contrato atual do endpoint `GET /payments/:orderId` no `payments-service`;
 - implementar webhook ou qualquer mecanismo de atualização automática de status de pedido a partir de eventos de pagamento;
 - criar novos endpoints nos serviços de domínio, exceto a remoção do endpoint de teste no `checkout-service` descrita na seção de limpeza.

 ---

 ## 1. Requisitos funcionais no api-gateway

 1. **Criar módulo de integração de pagamentos no gateway**

    - Deve existir um módulo dedicado à integração com o `payments-service`, com nome `PaymentsModule`.
    - O módulo deve usar a infraestrutura de proxy já existente no gateway (service name `payments` conforme `gateway.config.ts`).
    - O módulo deve ser auto-contido: apenas rotas de pagamento, reutilizando o mecanismo padrão de proxy.

 2. **Criar controller de proxy de pagamentos**

    - Deve existir um controller dedicado de proxy para pagamentos, com nome `PaymentsProxyController`.
    - O controller deve expor, no `api-gateway`, a rota:
      - `GET /payments/:orderId` → encaminhar para `payments-service` em `GET /payments/:orderId`.
    - A rota deve ser protegida por autenticação JWT, coerente com a proteção já adotada para rotas sensíveis no gateway.
    - O controller deve utilizar o mecanismo de proxy centralizado do gateway, incluindo:
      - uso do identificador de serviço `payments`;
      - reaproveitamento de timeout, retry e circuit breaker já padronizados;
      - repasse transparente de parâmetros de rota e headers relevantes.

 3. **Propagação de autenticação e contexto**

    - O header `Authorization` recebido no `api-gateway` deve ser obrigatoriamente repassado para o `payments-service` em todas as chamadas de pagamento.
    - Demais cabeçalhos necessários para rastreabilidade (por exemplo, correlação de requisições) devem seguir o padrão já adotado pelos demais proxies do gateway.
    - Em caso de falha de comunicação com o `payments-service`, o comportamento de fallback deve seguir o padrão global do `ProxyService` (mensagens de erro consistentes e não vazamento de detalhes internos).

 4. **Registrar `PaymentsModule` no `AppModule` do gateway**

    - O `PaymentsModule` deve ser registrado no módulo raiz da aplicação do `api-gateway`.
    - Após o registro, a rota `GET /payments/:orderId` deve ficar exposta na porta `3005`, obedecendo às mesmas convenções de autenticação e logging das demais rotas.

 ---

 ## 2. Limpeza no checkout-service

 1. **Remover endpoint de teste de envio de mensagem**

    - O `checkout-service` não deve expor nenhum endpoint de teste relacionado a envio de mensagens para filas.
    - O endpoint `POST /test/send-message` deve ser removido do controller principal (`AppController`), incluindo:
      - assinatura do método;
      - rota e qualquer decorator associado;
      - dependências exclusivamente utilizadas por este endpoint.

 2. **Manter apenas endpoints essenciais no `AppController`**

    - O controller principal do `checkout-service` deve manter apenas:
      - `GET /` para resposta básica de saúde/boas-vindas do serviço;
      - `GET /health` para health check estruturado.
    - Nenhum outro endpoint adicional deve permanecer no `AppController` após a limpeza desta spec.

 ---

 ## 3. Teste E2E completo via gateway (fluxo do marketplace)

 Os testes E2E devem exercitar todo o fluxo principal de compra do marketplace passando exclusivamente pelo `api-gateway` (porta `3005`), sem chamadas diretas aos microserviços internos.

 1. **Cenário 1: pagamento aprovado (produto com preço normal)**

    1. **Registrar usuários seller e buyer**
       - Registrar um usuário do tipo `seller` via gateway.
       - Registrar um usuário do tipo `buyer` via gateway.

    2. **Criar produtos como seller**
       - Autenticar como `seller` via endpoint de login no gateway e obter um token JWT válido.
       - Criar pelo menos um produto com preço "normal" (não terminando em `.99`) por meio do gateway.

    3. **Fluxo de compra como buyer**
       - Autenticar como `buyer` via gateway e obter token JWT próprio.
       - Navegar o catálogo de produtos via gateway (endpoint público de listagem).
       - Adicionar o produto "normal" ao carrinho do `buyer` por meio das rotas de carrinho do gateway.
       - Consultar o carrinho via gateway e validar que o produto correto está presente.

    4. **Checkout e verificação de pedido**
       - Executar o checkout do carrinho via gateway.
       - Após o checkout, obter o identificador do pedido criado (via resposta do checkout ou consulta subsequente de pedidos).
       - Consultar o pedido via gateway e validar que está registrado corretamente.

    5. **Consulta de pagamento aprovado**
       - Com o `orderId` do pedido, chamar o route de pagamento no gateway: `GET /payments/:orderId`.
       - Validar que o fluxo assíncrono de processamento foi completado e o pagamento retornado está com status de **aprovado**, conforme a regra de negócio simulada pelo `FakePaymentGatewayService` para preços "normais".

 2. **Cenário 2: pagamento rejeitado (produto com preço .99)**

    1. **Criar produto especial como seller**
       - Ainda autenticado como `seller` (ou autenticando novamente, se necessário), criar um produto cujo preço termine em `.99`, de forma que o `FakePaymentGatewayService` o trate como caso de rejeição.

    2. **Fluxo de compra como buyer**
       - Autenticar (ou reutilizar autenticação) como `buyer` via gateway.
       - Navegar o catálogo via gateway e identificar o produto com preço `.99`.
       - Adicionar o produto `.99` ao carrinho via gateway.
       - Consultar o carrinho via gateway para garantir que o item correto está presente.

    3. **Checkout e consulta de pedido**
       - Finalizar o checkout via gateway.
       - Obter o `orderId` do pedido gerado.
       - Consultar o pedido via gateway para garantir que está registrado.

    4. **Consulta de pagamento rejeitado**
       - Chamar, via gateway, o endpoint `GET /payments/:orderId` para este pedido.
       - Validar que o pagamento correspondente é retornado com status de **rejeitado**, de acordo com a regra de negócio associada a preços terminados em `.99`.

 3. **Requisitos gerais dos testes E2E**

    - Todas as chamadas de autenticação, catálogo, carrinho, checkout, pedidos e pagamentos devem ser feitas exclusivamente via `api-gateway` (porta `3005`), nunca diretamente nos microserviços.
    - Os testes devem aguardar o processamento assíncrono de pagamento sempre que necessário, respeitando os fluxos de fila do RabbitMQ já existentes (por exemplo, com polling controlado ou tempo de espera adequado).
    - Os tokens JWT utilizados nos testes devem ser obtidos por login real via gateway, garantindo que o fluxo de autenticação está funcional.
    - Asserções devem incluir:
      - status HTTP esperado em cada chamada;
      - payloads principais (por exemplo, itens de carrinho, detalhes do pedido, status do pagamento).

 ---

 ## 4. Critérios de aceite (claros e testáveis)

 1. **Integração de pagamentos no gateway**

    - Existe um `PaymentsModule` registrado no módulo raiz do `api-gateway`.
    - Existe um `PaymentsProxyController` responsável pelas rotas de pagamento.
    - O `api-gateway` expõe a rota `GET /payments/:orderId` protegida por JWT.
    - As chamadas a `GET /payments/:orderId` feitas no gateway são encaminhadas para o `payments-service` usando a configuração `payments` já existente no `gateway.config.ts`.
    - O header `Authorization` recebido pelo gateway é repassado intacto ao `payments-service`.

 2. **Limpeza no checkout-service**

    - O endpoint de teste `POST /test/send-message` não está mais presente no `checkout-service`.
    - O controller principal do `checkout-service` mantém apenas os endpoints `GET /` e `GET /health`.
    - Não existem outros endpoints "de teste" ou rotas internas expostas publicamente no `AppController`.

 3. **Fluxo E2E de pagamento aprovado**

    - É possível registrar `seller` e `buyer` via gateway.
    - É possível autenticar `seller` e criar produto com preço "normal" via gateway.
    - É possível autenticar `buyer`, navegar o catálogo, adicionar o produto ao carrinho, consultar o carrinho e realizar checkout via gateway.
    - Para o pedido gerado, a consulta `GET /payments/:orderId` via gateway retorna um pagamento com status **aprovado** após o processamento assíncrono.

 4. **Fluxo E2E de pagamento rejeitado**

    - É possível criar um produto com preço terminando em `.99` como `seller` via gateway.
    - É possível, como `buyer`, comprar este produto seguindo o mesmo fluxo de catálogo, carrinho e checkout via gateway.
    - Para o pedido gerado com produto `.99`, a consulta `GET /payments/:orderId` via gateway retorna um pagamento com status **rejeitado** após o processamento.

 5. **Cobertura E2E consolidada**

    - Os dois cenários E2E (aprovado e rejeitado) executam com sucesso em ambiente local, utilizando `users-service`, `products-service`, `checkout-service`, `payments-service` e RabbitMQ.
    - Todos os testes E2E utilizam exclusivamente o `api-gateway` como ponto de entrada.
    - Não há implementação de webhook de atualização automática de status de pedido; o status de pagamento é obtido apenas por meio da consulta `GET /payments/:orderId` via gateway.

