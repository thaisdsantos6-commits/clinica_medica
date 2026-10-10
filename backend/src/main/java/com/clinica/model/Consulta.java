package model;

import java.time.LocalDateTime;

public class Consulta {
    private int id;
    private Paciente paciente;
    private String medico;
    private LocalDateTime dataHora;
    private String status;
    private Long orcamentoCentavos;

    public Consulta(int id, Paciente paciente, String medico, LocalDateTime dataHora) {
        this.id = id;
        this.paciente = paciente;
        this.medico = medico;
        this.dataHora = dataHora;
        this.status = "AGENDADA";
    }

    public int getId() { return id; }
    public Paciente getPaciente() { return paciente; }
    public String getMedico() { return medico; }
    public LocalDateTime getDataHora() { return dataHora; }
    public void setDataHora(LocalDateTime dataHora) { this.dataHora = dataHora; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getOrcamentoCentavos() { return orcamentoCentavos; }
    public void setOrcamentoCentavos(Long orcamentoCentavos) { this.orcamentoCentavos = orcamentoCentavos; }

    @Override
    public String toString() {
        return "Paciente: " + paciente.getNome()
                + " | Médico: " + medico
                + " | Data: " + dataHora
                + " | Status: " + status;
    }
}
