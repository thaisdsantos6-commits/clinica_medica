import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import controller.PacienteController;
import model.Consulta;
import model.Paciente;
import model.Usuario;
import repository.PacienteRepository;
import service.AgendaService;
import service.AutenticacaoService;
import service.PacienteService;

/**
 * Servidor HTTP (somente JDK): serve o front-end estático (pasta "frontend")
 * e a API REST em /api. Os dados ficam em memória.
 *
 * Execute a partir da raiz do projeto (veja run.bat), pois a pasta "frontend"
 * é procurada a partir do diretório atual.
 */
public class ApiServer {
    private static final int PORTA = 8080;
    private static final String COOKIE_SESSAO = "CLINICA_SESSAO";
    private static final int TAMANHO_MAX_CORPO = 400_000;   // bytes (cabe a foto de até 200 mil caracteres)

    private static final AutenticacaoService authService = new AutenticacaoService();
    private static final PacienteService pacienteService = new PacienteService(new PacienteRepository());
    private static final AgendaService agendaService = new AgendaService();
    private static final PacienteController pacienteController = new PacienteController(pacienteService, agendaService);

    private static final Path FRONTEND = Paths.get("frontend").toAbsolutePath().normalize();

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORTA), 0);

        server.createContext("/api/login", seguro(ApiServer::login));
        server.createContext("/api/logout", seguro(ApiServer::logout));
        server.createContext("/api/patients", seguro(ApiServer::patients));
        server.createContext("/api/appointments", seguro(ApiServer::appointments));
        server.createContext("/", seguro(ApiServer::staticFiles));

        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        System.out.println("Sistema Clínica Médica iniciado.");
        System.out.println("Acesse: http://localhost:" + PORTA);
    }

    /**
     * Envolve um handler: erros de validação (IllegalArgumentException) viram 400 com a
     * mensagem; qualquer outro erro inesperado vira 500 em JSON, em vez de derrubar a conexão.
     */
    private static HttpHandler seguro(HttpHandler handler) {
        return ex -> {
            try {
                handler.handle(ex);
            } catch (IllegalArgumentException e) {
                responderErro(ex, 400, e.getMessage());
            } catch (RuntimeException e) {
                e.printStackTrace();
                responderErro(ex, 500, "Erro interno do servidor.");
            } finally {
                ex.close();
            }
        };
    }

    // ------------------------------------------------------------------ rotas

    private static void login(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendError(ex, 405, "Método não permitido.");
            return;
        }

        Map<String, String> corpo = lerJson(ex);
        Usuario usuario = authService.autenticar(campo(corpo, "login"), campo(corpo, "senha"));

        if (usuario == null) {
            sendError(ex, 401, "Login ou senha inválidos.");
            return;
        }

        String token = authService.iniciarSessao(usuario);
        ex.getResponseHeaders().add("Set-Cookie",
                COOKIE_SESSAO + "=" + token + "; Path=/; HttpOnly; SameSite=Strict");

        sendJson(ex, 200, "{"
                + "\"login\":\"" + esc(usuario.getLogin()) + "\","
                + "\"papel\":\"" + esc(usuario.getPapel()) + "\""
                + "}");
    }

    private static void logout(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendError(ex, 405, "Método não permitido.");
            return;
        }

        authService.encerrarSessao(tokenDaSessao(ex));
        ex.getResponseHeaders().add("Set-Cookie",
                COOKIE_SESSAO + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        sendJson(ex, 200, "{\"ok\":true}");
    }

    private static void patients(HttpExchange ex) throws IOException {
        if (!autenticado(ex)) return;

        String method = ex.getRequestMethod();
        String path = ex.getRequestURI().getPath();

        if ("GET".equalsIgnoreCase(method) && path.equals("/api/patients")) {
            StringBuilder json = new StringBuilder("[");
            List<Paciente> pacientes = pacienteController.listar();
            for (int i = 0; i < pacientes.size(); i++) {
                if (i > 0) json.append(",");
                json.append(patientJson(pacientes.get(i), true));
            }
            json.append("]");
            sendJson(ex, 200, json.toString());
            return;
        }

        if ("POST".equalsIgnoreCase(method) && path.equals("/api/patients")) {
            Map<String, String> corpo = lerJson(ex);
            // as validações (campos obrigatórios, tamanho, CPF, foto) ficam em PacienteService
            Paciente paciente = pacienteController.cadastrar(
                    campo(corpo, "nome"), campo(corpo, "cpf"), campo(corpo, "convenio"), campo(corpo, "foto"));
            sendJson(ex, 201, patientJson(paciente, true));
            return;
        }

        if ("PUT".equalsIgnoreCase(method) && path.matches("/api/patients/\\d{1,9}")) {
            int id = idDoCaminho(path);
            Map<String, String> corpo = lerJson(ex);
            Paciente paciente = pacienteController.atualizar(
                    id, campo(corpo, "nome"), campo(corpo, "cpf"),
                    campo(corpo, "convenio"), campo(corpo, "foto"));
            if (paciente == null) {
                sendError(ex, 404, "Paciente não encontrado.");
                return;
            }
            sendJson(ex, 200, patientJson(paciente, true));
            return;
        }

        if ("DELETE".equalsIgnoreCase(method) && path.matches("/api/patients/\\d{1,9}")) {
            int id = idDoCaminho(path);
            if (!pacienteController.remover(id)) {
                sendError(ex, 404, "Paciente não encontrado.");
                return;
            }
            sendJson(ex, 200, "{\"ok\":true}");
            return;
        }

        sendError(ex, 405, "Método não permitido.");
    }

    private static void appointments(HttpExchange ex) throws IOException {
        if (!autenticado(ex)) return;

        String method = ex.getRequestMethod();
        String path = ex.getRequestURI().getPath();

        if ("GET".equalsIgnoreCase(method) && path.equals("/api/appointments")) {
            StringBuilder json = new StringBuilder("[");
            List<Consulta> consultas = agendaService.listarTodas();
            for (int i = 0; i < consultas.size(); i++) {
                if (i > 0) json.append(",");
                json.append(appointmentJson(consultas.get(i)));
            }
            json.append("]");
            sendJson(ex, 200, json.toString());
            return;
        }

        if ("POST".equalsIgnoreCase(method) && path.equals("/api/appointments")) {
            Map<String, String> corpo = lerJson(ex);

            int pacienteId = parseId(campo(corpo, "pacienteId"), "Paciente");
            Paciente paciente = pacienteController.buscarPorId(pacienteId);
            if (paciente == null) {
                sendError(ex, 404, "Paciente não encontrado.");
                return;
            }

            LocalDateTime dataHora = parseDataHora(campo(corpo, "dataHora"));
            // médico obrigatório, data futura e horário livre são validados em AgendaService
            Consulta consulta = agendaService.agendar(
                    paciente, campo(corpo, "medico"), dataHora,
                    parseOrcamentoCentavos(corpo.get("orcamentoCentavos")));
            sendJson(ex, 201, appointmentJson(consulta));
            return;
        }

        if ("PUT".equalsIgnoreCase(method) && path.matches("/api/appointments/\\d{1,9}/budget")) {
            int id = idDoCaminho(path.substring(0, path.lastIndexOf('/')));
            Map<String, String> corpo = lerJson(ex);
            if (!corpo.containsKey("orcamentoCentavos")) {
                throw new IllegalArgumentException("Informe o orçamento da consulta.");
            }
            Consulta consulta = agendaService.atualizarOrcamento(
                    id, parseOrcamentoCentavos(corpo.get("orcamentoCentavos")));
            if (consulta == null) {
                sendError(ex, 404, "Consulta não encontrada.");
                return;
            }
            sendJson(ex, 200, appointmentJson(consulta));
            return;
        }

        if ("PUT".equalsIgnoreCase(method) && path.matches("/api/appointments/\\d{1,9}")) {
            int id = idDoCaminho(path);
            Map<String, String> corpo = lerJson(ex);

            LocalDateTime novaDataHora = parseDataHora(campo(corpo, "dataHora"));
            Consulta consulta = agendaService.reagendar(id, novaDataHora);
            if (consulta == null) {
                sendError(ex, 404, "Consulta não encontrada.");
                return;
            }
            sendJson(ex, 200, appointmentJson(consulta));
            return;
        }

        sendError(ex, 405, "Método não permitido.");
    }

    private static void staticFiles(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendError(ex, 405, "Método não permitido.");
            return;
        }

        String requestPath = ex.getRequestURI().getPath();
        if (requestPath.equals("/")) requestPath = "/index.html";

        Path file = FRONTEND.resolve(requestPath.substring(1)).normalize();

        if (!file.startsWith(FRONTEND) || !Files.exists(file) || Files.isDirectory(file)) {
            sendError(ex, 404, "Página não encontrada.");
            return;
        }

        byte[] bytes = Files.readAllBytes(file);
        Headers headers = ex.getResponseHeaders();
        headers.set("Content-Type", contentType(file));
        headers.set("X-Content-Type-Options", "nosniff");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    // ------------------------------------------------------------ autenticação

    /** Exige sessão válida (cookie). Se não houver, responde 401 e retorna false. */
    private static boolean autenticado(HttpExchange ex) throws IOException {
        if (authService.validarSessao(tokenDaSessao(ex)) != null) return true;
        sendError(ex, 401, "Sessão inexistente ou expirada. Faça login novamente.");
        return false;
    }

    private static String tokenDaSessao(HttpExchange ex) {
        List<String> cabecalhos = ex.getRequestHeaders().get("Cookie");
        if (cabecalhos == null) return null;
        for (String linha : cabecalhos) {
            for (String par : linha.split(";")) {
                String[] chaveValor = par.trim().split("=", 2);
                if (chaveValor.length == 2 && chaveValor[0].equals(COOKIE_SESSAO)) {
                    return chaveValor[1];
                }
            }
        }
        return null;
    }

    // ------------------------------------------------------- entrada (parsing)

    private static int idDoCaminho(String path) {
        return Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));   // o caminho já foi validado por regex
    }

    private static int parseId(String texto, String rotulo) {
        if (texto.isBlank()) throw new IllegalArgumentException(rotulo + " é obrigatório.");
        try {
            return Integer.parseInt(texto.strip());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(rotulo + " inválido.");
        }
    }

    private static Long parseOrcamentoCentavos(String texto) {
        if (texto == null || texto.isBlank()) return null;
        try {
            long centavos = Long.parseLong(texto);
            if (centavos < 0) throw new IllegalArgumentException("O orçamento deve ser igual ou maior que zero.");
            return centavos;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Orçamento inválido. Informe o valor em centavos.");
        }
    }

    /** Aceita "yyyy-MM-ddTHH:mm" (com ou sem segundos). */
    private static LocalDateTime parseDataHora(String texto) {
        if (texto.isBlank()) throw new IllegalArgumentException("Informe a data e a hora da consulta.");
        try {
            return LocalDateTime.parse(texto.strip());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Formato inválido. Informe uma data e hora válidas.");
        }
    }

    private static String campo(Map<String, String> corpo, String chave) {
        String valor = corpo.get(chave);
        return valor == null ? "" : valor;
    }

    private static Map<String, String> lerJson(HttpExchange ex) throws IOException {
        return new LeitorJson(readBody(ex)).objeto();
    }

    private static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            byte[] bytes = in.readNBytes(TAMANHO_MAX_CORPO + 1);
            if (bytes.length > TAMANHO_MAX_CORPO) {
                throw new IllegalArgumentException("Requisição grande demais.");
            }
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    /**
     * Leitor mínimo de um objeto JSON "plano" (sem objetos/arrays aninhados), suficiente para
     * os corpos desta API. Valores string são decodificados (escapes e \\uXXXX); números e
     * booleanos viram texto; null vira null. JSON inválido gera IllegalArgumentException.
     */
    private static final class LeitorJson {
        private final String s;
        private int i = 0;

        LeitorJson(String s) {
            this.s = s;
        }

        Map<String, String> objeto() {
            Map<String, String> mapa = new HashMap<>();
            pularEspacos();
            esperar('{');
            pularEspacos();
            if (olhar() == '}') {
                i++;
                return fim(mapa);
            }
            while (true) {
                pularEspacos();
                String chave = texto();
                pularEspacos();
                esperar(':');
                pularEspacos();
                mapa.put(chave, valor());
                pularEspacos();
                char c = ler();
                if (c == '}') return fim(mapa);
                if (c != ',') throw erro();
            }
        }

        private Map<String, String> fim(Map<String, String> mapa) {
            pularEspacos();
            if (i != s.length()) throw erro();
            return mapa;
        }

        private String valor() {
            if (olhar() == '"') return texto();
            int inicio = i;
            while (i < s.length() && ",}".indexOf(s.charAt(i)) < 0 && !Character.isWhitespace(s.charAt(i))) i++;
            String token = s.substring(inicio, i);
            if (token.isEmpty() || token.startsWith("{") || token.startsWith("[")) throw erro();
            return token.equals("null") ? null : token;
        }

        private String texto() {
            esperar('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = ler();
                if (c == '"') return sb.toString();
                if (c != '\\') {
                    sb.append(c);
                    continue;
                }
                char e = ler();
                switch (e) {
                    case '"': case '\\': case '/': sb.append(e); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        if (i + 4 > s.length() || !s.substring(i, i + 4).matches("[0-9a-fA-F]{4}")) throw erro();
                        sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default:
                        throw erro();
                }
            }
        }

        private void pularEspacos() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }

        private char olhar() {
            if (i >= s.length()) throw erro();
            return s.charAt(i);
        }

        private char ler() {
            if (i >= s.length()) throw erro();
            return s.charAt(i++);
        }

        private void esperar(char esperado) {
            if (ler() != esperado) throw erro();
        }

        private IllegalArgumentException erro() {
            return new IllegalArgumentException("Requisição inválida: envie um objeto JSON válido.");
        }
    }

    // ------------------------------------------------------------ saída (JSON)

    /** A foto só é incluída quando solicitada (nas consultas ela não é necessária e deixaria a resposta pesada). */
    private static String patientJson(Paciente p, boolean incluirFoto) {
        String json = "{"
                + "\"id\":" + p.getId() + ","
                + "\"nome\":\"" + esc(p.getNome()) + "\","
                + "\"cpf\":\"" + esc(p.getCpf()) + "\","
                + "\"convenio\":\"" + esc(p.getConvenio()) + "\"";
        if (incluirFoto) {
            json += ",\"foto\":" + (p.getFoto() == null ? "null" : "\"" + esc(p.getFoto()) + "\"");
        }
        return json + "}";
    }

    private static String appointmentJson(Consulta c) {
        return "{"
                + "\"id\":" + c.getId() + ","
                + "\"paciente\":" + patientJson(c.getPaciente(), false) + ","
                + "\"medico\":\"" + esc(c.getMedico()) + "\","
                + "\"dataHora\":\"" + c.getDataHora().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + "\","
                + "\"orcamentoCentavos\":" + (c.getOrcamentoCentavos() == null ? "null" : c.getOrcamentoCentavos()) + ","
                + "\"status\":\"" + esc(c.getStatus()) + "\""
                + "}";
    }

    private static String esc(String value) {
        if (value == null) return "";
        StringBuilder sb = new StringBuilder(value.length() + 16);
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }

    private static void sendError(HttpExchange ex, int status, String message) throws IOException {
        sendJson(ex, status, "{\"error\":\"" + esc(message) + "\"}");
    }

    /** Usado pelo wrapper de erros: nunca lança (a resposta pode já ter sido enviada). */
    private static void responderErro(HttpExchange ex, int status, String message) {
        try {
            sendError(ex, status, message);
        } catch (IOException | RuntimeException ignorada) {
            // cliente desconectou ou a resposta já havia sido enviada
        }
    }

    private static void sendJson(HttpExchange ex, int status, String json) throws IOException {
        Headers headers = ex.getResponseHeaders();
        headers.set("Content-Type", "application/json; charset=UTF-8");
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".html")) return "text/html; charset=UTF-8";
        if (name.endsWith(".css")) return "text/css; charset=UTF-8";
        if (name.endsWith(".js")) return "application/javascript; charset=UTF-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
