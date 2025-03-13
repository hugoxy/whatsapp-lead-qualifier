# WhatsApp Lead Qualifier

Este projeto é um qualificador de leads que utiliza o WhatsApp para interagir com os usuários e qualificar leads com base em suas respostas a uma série de perguntas. O sistema também possui um widget de chat para qualificação de leads via web.

## Objetivo

O objetivo deste projeto é automatizar o processo de qualificação de leads, utilizando o WhatsApp e um widget de chat na web para coletar informações dos usuários e determinar se eles são leads qualificados ou não.

## Funcionalidades

- Interação com usuários via WhatsApp para qualificação de leads.
- Widget de chat na web para qualificação de leads.
- Armazenamento das respostas dos usuários em um arquivo JSON.
- Qualificação de leads utilizando um modelo de IA.


## Branch
- A versão de codigo do branch auto-generate-questions gera as 5 perguntas de maneira automatica utilizando a IA.

## Requisitos

- Node.js (versão 14 ou superior)
- NPM (Node Package Manager)
- Conta no WhatsApp Business API
- Servidor de IA (Ollama)

## Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/whatsapp-lead-qualifier.git
   cd whatsapp-lead-qualifier
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure o servidor de IA (Ollama) e certifique-se de que ele está rodando na porta `11434`.

## Uso

1. Inicie o servidor:

   ```bash
   node server.js
   ```

2. Abra o navegador e acesse `http://localhost:3000` para visualizar o widget de chat.

3. Para conectar ao WhatsApp, siga as instruções no terminal para escanear o QR code.

## Estrutura do Projeto

- `index.js`: Script principal para conectar ao WhatsApp e gerenciar a qualificação de leads.
- `server.js`: Servidor Express para servir o widget de chat e gerenciar a qualificação de leads via web.
- `public/index.html`: Arquivo HTML para o widget de chat.
- `leads.json`: Arquivo JSON onde as respostas dos usuários são armazenadas.
- `whatsapp_auth`: Pasta onde as credenciais do WhatsApp são armazenadas.

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
