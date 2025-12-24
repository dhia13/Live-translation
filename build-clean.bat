@echo off
echo ============================================
echo Clean Build: whisper.cpp with OpenVINO
echo ============================================

REM Setup OpenVINO environment
echo Setting up OpenVINO environment...
call "C:\intel\openvino_2024.6\setupvars.bat"

cd native\whisper

echo.
echo Removing old build directory...
if exist build (
    rmdir /s /q build
    echo Old build removed.
) else (
    echo No old build found.
)

echo.
echo Creating fresh build directory...
mkdir build
cd build

echo.
echo [1/3] Configuring with CMake...
cmake .. -G "Visual Studio 17 2022" -A x64 ^
    -DWHISPER_OPENVINO=ON ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DWHISPER_BUILD_EXAMPLES=ON ^
    -DOpenVINO_DIR="C:/intel/openvino_2024.6/runtime/cmake" ^
    -DCMAKE_PREFIX_PATH="C:/intel/openvino_2024.6"

if %ERRORLEVEL% NEQ 0 (
    echo CMake configuration failed!
    cd ..\..\..
    pause
    exit /b 1
)

echo.
echo [2/3] Building...
cmake --build . --config Release --parallel

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    cd ..\..\..
    pause
    exit /b 1
)

echo.
echo [3/3] Copying files...

REM Create ddl directory
if not exist ..\..\ddl mkdir ..\..\ddl

REM Copy DLLs and EXEs
copy bin\Release\*.dll ..\..\ddl\
copy bin\Release\main.exe ..\..\ddl\
copy bin\Release\whisper-cli.exe ..\..\ddl\

cd ..\..\..

echo.
echo ============================================
echo Build complete!
echo ============================================

pause