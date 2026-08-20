@echo off
echo ===================================================
echo   Starting PostgreSQL Service (CityConnect DB)
echo ===================================================
echo.
net start postgresql-x64-18
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Could not start PostgreSQL service.
    echo Please RIGHT-CLICK 'start-postgres.bat' and select 'Run as administrator'.
    echo.
    pause
) else (
    echo.
    echo [SUCCESS] PostgreSQL Database is now RUNNING!
    echo You can now use the CityConnect login page.
    echo.
    timeout /t 5
)
