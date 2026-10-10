package util;

import java.security.SecureRandom;

/**
 * Geração segura de tokens de sessão.
 * Usa apenas o JDK (sem bibliotecas externas).
 */
public final class Seguranca {
    private static final SecureRandom RANDOM = new SecureRandom();

    private Seguranca() {
    }

    /** Token aleatório (256 bits, em hexadecimal) para identificar uma sessão. */
    public static String gerarToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
