# Clínica Médica

## Descrição

Sistema de gerenciamento de clínica médica (Centro de Saúde Vitalis), desenvolvido para demonstrar conhecimentos de desenvolvimento web, backend, frontend, organização em camadas (MVC), autenticação, cadastro de pacientes e agendamento de consultas.

O backend em Java usa apenas o JDK (sem Spring, Maven ou Gradle) e também serve o frontend, então basta um comando para executar tudo.

> **Projeto de demonstração.** Os dados ficam **em memória** e são perdidos ao reiniciar o servidor.

## Tecnologias

- Java (somente JDK: `com.sun.net.httpserver`)
- HTML5
- CSS3
- JavaScript (puro, sem frameworks)
- API REST (JSON sobre HTTP)
- Arquitetura em camadas / MVC
- Git e GitHub

## Funcionalidades

- **Login e logout**, com sessão controlada pelo servidor (cookie `HttpOnly`) e encerramento por inatividade (10 min)
- **Cadastro de pacientes** (nome, CPF, convênio e foto opcional), com validação de CPF
- **Listagem de pacientes**, com busca por nome, CPF ou convênio e CPF mascarado na tabela
- **Exclusão de pacientes** (as consultas do paciente excluído também são removidas)
- **Agendamento de consultas** (paciente, médico, data e hora), com orçamento total opcional em reais
- **Edição e remoção do orçamento** pela agenda, com valores exibidos em BRL
- **Reagendamento** e **listagem de consultas**, agrupadas por dia
- **Dashboard** (tela inicial) com a próxima consulta, totais e próximos atendimentos
- **Validação de dados** no frontend (retorno rápido) e **novamente no backend** (a regra que vale)
- Tema claro/escuro

## Estrutura

| Pasta | Responsabilidade |
|---|---|
| `backend/` | Código Java (servidor e API) |
| `backend/src/controller` | Liga a camada HTTP às regras de negócio (`PacienteController`) |
| `backend/src/model` | Entidades: `Paciente`, `Consulta`, `Usuario` |
| `backend/src/repository` | Armazenamento e consulta de dados (`PacienteRepository`, em memória) |
| `backend/src/service` | Regras de negócio e validações: `PacienteService`, `AgendaService`, `AutenticacaoService` |
| `backend/src/util` | Funções auxiliares: `Seguranca` (hash de senha e tokens) |
| `backend/src/ApiServer.java` | Ponto de entrada: rotas `/api` e arquivos do frontend |
| `frontend/` | Interface web: `index.html`, `style.css`, `app.js` |
| `docs/` | Documentação adicional (`API.md`) |

```text
clinica-medica/
├── backend/
│   ├── src/
│   │   ├── controller/
│   │   │   └── PacienteController.java
│   │   ├── model/
│   │   │   ├── Paciente.java
│   │   │   ├── Consulta.java
│   │   │   └── Usuario.java
│   │   ├── repository/
│   │   │   └── PacienteRepository.java
│   │   ├── service/
│   │   │   ├── PacienteService.java
│   │   │   ├── AgendaService.java
│   │   │   └── AutenticacaoService.java
│   │   ├── util/
│   │   │   └── Seguranca.java
│   │   └── ApiServer.java
│   └── README.md
├── docs/
│   └── API.md
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── .gitattributes
├── .gitignore
├── README.md
└── run.bat
```

## Requisitos

- **JDK 11 ou superior** (o código usa `String.isBlank()`, `String.strip()` e `InputStream.readNBytes`, disponíveis a partir do Java 11). O comando `javac` precisa estar no `PATH`; um JRE sozinho não compila.
- Um navegador moderno. As fontes vêm do Google Fonts; sem internet o sistema funciona normalmente com fontes do sistema.

## Como executar

### Windows (recomendado)

1. Instale o JDK 11+ e confirme com `javac -version` no terminal.
2. Dê duplo clique em `run.bat` (ou execute `run.bat` no terminal, dentro da pasta do projeto). Ele compila o backend na pasta `out/` e inicia o servidor.
3. Abra <http://localhost:8080> no navegador.
4. Para encerrar, feche a janela ou pressione `Ctrl+C`.

### Manualmente (Windows, Linux ou macOS)

Na **raiz** do projeto (o servidor procura a pasta `frontend/` a partir do diretório atual):

```bash
# Linux/macOS
mkdir -p out
javac -encoding UTF-8 -d out $(find backend/src -name '*.java')
java -cp out ApiServer
```

```bat
:: Windows (cmd)
mkdir out
javac -encoding UTF-8 -d out backend\src\ApiServer.java backend\src\util\Seguranca.java backend\src\model\Usuario.java backend\src\model\Paciente.java backend\src\model\Consulta.java backend\src\repository\PacienteRepository.java backend\src\service\AutenticacaoService.java backend\src\service\PacienteService.java backend\src\service\AgendaService.java backend\src\controller\PacienteController.java
java -cp out ApiServer
```

Depois acesse <http://localhost:8080>.

### Credencial de demonstração

| Usuário | Senha |
|---|---|
| `admin` | `123456` |

É uma credencial **somente de demonstração**. Para usar outra, defina as variáveis de ambiente antes de iniciar o servidor:

```bat
set CLINICA_ADMIN_LOGIN=seu_login
set CLINICA_ADMIN_SENHA=sua_senha
run.bat
```

```bash
CLINICA_ADMIN_LOGIN=seu_login CLINICA_ADMIN_SENHA=sua_senha java -cp out ApiServer
```

## API

Resumo dos endpoints (detalhes, corpos e respostas em [`docs/API.md`](docs/API.md)):

| Método | URL | Finalidade |
|---|---|---|
| `POST` | `/api/login` | Autentica e abre a sessão |
| `POST` | `/api/logout` | Encerra a sessão |
| `GET` | `/api/patients` | Lista pacientes |
| `POST` | `/api/patients` | Cadastra paciente |
| `DELETE` | `/api/patients/{id}` | Exclui paciente |
| `GET` | `/api/appointments` | Lista consultas |
| `POST` | `/api/appointments` | Agenda consulta (aceita `orcamentoCentavos` opcional, inteiro em centavos) |
| `PUT` | `/api/appointments/{id}` | Reagenda consulta |
| `PUT` | `/api/appointments/{id}/budget` | Atualiza ou remove o orçamento (`orcamentoCentavos`; `null` remove) |

Todas as rotas, exceto `/api/login` e `/api/logout`, exigem sessão válida (`401` caso contrário).

## Segurança

- As credenciais presentes no projeto (`admin` / `123456`) são **apenas para demonstração** e estão identificadas como DEMO em `AutenticacaoService.java`. Não use em produção.
- Senhas são guardadas como hash **PBKDF2-HMAC-SHA256** com salt aleatório e comparadas em tempo constante (`util/Seguranca.java`).
- A sessão é um token aleatório de 256 bits em cookie `HttpOnly` + `SameSite=Strict`; expira após 10 minutos sem uso.
- Todas as validações do frontend são repetidas no backend.
- O frontend renderiza dados com `textContent` (nunca `innerHTML`) para evitar XSS.
- **Nunca publique** `.env`, senhas reais, tokens, chaves privadas ou credenciais. O `.gitignore` já ignora `.env` e arquivos compilados.

**Limitações conhecidas (por ser demonstração):** tráfego em HTTP sem TLS, sem limite de tentativas de login no servidor (o bloqueio de 5 tentativas existe apenas na interface), um único usuário/perfil e dados apenas em memória.

## Melhorias futuras

- Banco de dados real
- Autenticação mais robusta (HTTPS, limite de tentativas no servidor, múltiplos usuários)
- Controle de permissões por perfil
- Edição de pacientes
- Cancelamento de consultas
- Testes automatizados
- Documentação da API em formato OpenAPI
- Deploy
