package service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import model.Usuario;
import util.Seguranca;

/** Autenticação via Supabase Auth e controle local de sessões. */
public class AutenticacaoService {
    public static final int LOGIN_MAX = 254;
    public static final int SENHA_MAX = 1024;
    public static final long INATIVIDADE_MS = 10 * 60 * 1000L;

    private final URI endpointLogin;
    private final String chavePublica;
    private final HttpClient cliente;
    private final Map<String, Sessao> sessoes = new HashMap<>();

    private static final class Sessao {
        final String login;
        long ultimoUso;

        Sessao(String login, long ultimoUso) {
            this.login = login;
            this.ultimoUso = ultimoUso;
        }
    }

    public AutenticacaoService() {
        String url = System.getenv("SUPABASE_URL");
        chavePublica = System.getenv("SUPABASE_ANON_KEY");
        if (url == null || url.isBlank() || chavePublica == null || chavePublica.isBlank()) {
            throw new IllegalStateException(
                    "Configure SUPABASE_URL e SUPABASE_ANON_KEY antes de iniciar o servidor.");
        }

        endpointLogin = URI.create(url.replaceAll("/+$", "") + "/auth/v1/token?grant_type=password");
        cliente = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /**
     * Retorna o usuário se o e-mail e a senha forem válidos e null se forem inválidos.
     * Lança IllegalArgumentException se os campos estiverem vazios ou grandes demais.
     */
    public Usuario autenticar(String login, String senha) {
        if (login == null || login.isBlank() || senha == null || senha.isBlank()) {
            throw new IllegalArgumentException("E-mail e senha são obrigatórios.");
        }
        if (login.length() > LOGIN_MAX || senha.length() > SENHA_MAX) {
            throw new IllegalArgumentException("E-mail ou senha excedem o tamanho máximo permitido.");
        }

        HttpRequest requisicao = HttpRequest.newBuilder(endpointLogin)
                .timeout(Duration.ofSeconds(15))
                .header("apikey", chavePublica)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"email\":\"" + json(login) + "\",\"password\":\"" + json(senha) + "\"}"))
                .build();

        try {
            HttpResponse<Void> resposta = cliente.send(requisicao, HttpResponse.BodyHandlers.discarding());
            int status = resposta.statusCode();
            if (status == 400 || status == 401) return null;
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("Supabase Auth respondeu com HTTP " + status + ".");
            }
            return new Usuario(login, "ADMIN");
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível conectar ao Supabase Auth.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("A autenticação no Supabase foi interrompida.", e);
        }
    }

    private static String json(String valor) {
        StringBuilder resultado = new StringBuilder(valor.length() + 16);
        for (char c : valor.toCharArray()) {
            switch (c) {
                case '"': resultado.append("\\\""); break;
                case '\\': resultado.append("\\\\"); break;
                case '\b': resultado.append("\\b"); break;
                case '\f': resultado.append("\\f"); break;
                case '\n': resultado.append("\\n"); break;
                case '\r': resultado.append("\\r"); break;
                case '\t': resultado.append("\\t"); break;
                default:
                    if (c < 0x20) resultado.append(String.format("\\u%04x", (int) c));
                    else resultado.append(c);
            }
        }
        return resultado.toString();
    }

    // ---------------------------------------------------------------- sessões

    /** Cria uma sessão local e devolve o token enviado ao navegador em cookie HttpOnly. */
    public synchronized String iniciarSessao(Usuario usuario) {
        long agora = System.currentTimeMillis();
        sessoes.values().removeIf(s -> agora - s.ultimoUso > INATIVIDADE_MS);
        String token = Seguranca.gerarToken();
        sessoes.put(token, new Sessao(usuario.getLogin(), agora));
        return token;
    }

    /** Retorna o usuário da sessão (renovando o prazo de inatividade) ou null se inexistente/expirada. */
    public synchronized Usuario validarSessao(String token) {
        if (token == null) return null;
        Sessao sessao = sessoes.get(token);
        if (sessao == null) return null;

        long agora = System.currentTimeMillis();
        if (agora - sessao.ultimoUso > INATIVIDADE_MS) {
            sessoes.remove(token);
            return null;
        }
        sessao.ultimoUso = agora;
        return new Usuario(sessao.login, "ADMIN");
    }

    public synchronized void encerrarSessao(String token) {
        if (token != null) sessoes.remove(token);
    }
}
