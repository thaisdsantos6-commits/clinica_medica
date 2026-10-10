@echo off
chcp 65001 >nul
title Clinica Medica
cd /d "%~dp0"

rem ------------------------------------------------------------------
rem  Compila o backend (Java) para a pasta "out" e inicia o servidor.
rem  Uso: de um duplo clique neste arquivo ou execute "run.bat" na raiz.
rem  Requer JDK 11 ou superior (comando "javac" disponivel no PATH).
rem
rem  Configure as variaveis Supabase documentadas no README antes de iniciar.
rem ------------------------------------------------------------------

echo.
echo ========================================
echo      SISTEMA CLINICA MEDICA
echo ========================================
echo.

where javac >nul 2>nul
if errorlevel 1 (
    echo ERRO: "javac" nao encontrado.
    echo Instale o JDK 11 ou superior e abra um novo terminal.
    pause
    exit /b 1
)

if "%SUPABASE_URL%"=="" (
    echo ERRO: configure SUPABASE_URL no ambiente antes de iniciar.
    pause
    exit /b 1
)

if "%SUPABASE_ANON_KEY%"=="" (
    echo ERRO: configure SUPABASE_ANON_KEY no ambiente antes de iniciar.
    pause
    exit /b 1
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    echo ERRO: configure SUPABASE_SERVICE_ROLE_KEY no ambiente do backend.
    pause
    exit /b 1
)

if "%SUPABASE_ADMIN_EMAIL%"=="" (
    echo ERRO: configure SUPABASE_ADMIN_EMAIL no ambiente do backend.
    pause
    exit /b 1
)

echo Compilando Java...

if exist out rmdir /s /q out
mkdir out

set "SRC=backend\src\ApiServer.java"
set "SRC=%SRC% backend\src\util\Seguranca.java"
set "SRC=%SRC% backend\src\model\Usuario.java"
set "SRC=%SRC% backend\src\model\Paciente.java"
set "SRC=%SRC% backend\src\model\Consulta.java"
set "SRC=%SRC% backend\src\repository\PacienteRepository.java"
set "SRC=%SRC% backend\src\service\AutenticacaoService.java"
set "SRC=%SRC% backend\src\service\PacienteService.java"
set "SRC=%SRC% backend\src\service\AgendaService.java"
set "SRC=%SRC% backend\src\controller\PacienteController.java"

javac -encoding UTF-8 -d out %SRC%

if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel compilar.
    echo Verifique se o JDK esta instalado e se "javac" funciona no terminal.
    pause
    exit /b 1
)

echo.
echo Servidor iniciado em http://localhost:8080
echo Feche esta janela (ou pressione Ctrl+C) para encerrar o sistema.
echo.

java -cp out ApiServer

pause
