package model;

public class Usuario {
    private String login;
    private String papel;

    public Usuario(String login, String papel) {
        this.login = login;
        this.papel = papel;
    }

    public String getLogin() { return login; }
    public String getPapel() { return papel; }
}
