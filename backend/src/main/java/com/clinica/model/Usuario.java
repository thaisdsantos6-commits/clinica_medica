package model;

public class Usuario {
    private String login;
    private String senhaHash;
    private String papel;

    public Usuario(String login, String senhaHash, String papel) {
        this.login = login;
        this.senhaHash = senhaHash;
        this.papel = papel;
    }

    public String getLogin() { return login; }
    public String getSenhaHash() { return senhaHash; }
    public String getPapel() { return papel; }
}
