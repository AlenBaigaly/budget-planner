#!/usr/bin/env python3
import sys
import os
import http.server
import socketserver

# Change directory to the folder containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Parse port argument, stripping any accidental characters like '~' or whitespace
requested_port = 8080
if len(sys.argv) > 1:
    clean_arg = sys.argv[1].strip('~ \t\r\n')
    try:
        requested_port = int(clean_arg)
    except ValueError:
        print(f"⚠️ Некорректный номер порта '{sys.argv[1]}', используем порт по умолчанию {requested_port}")

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

# Try binding, if port is busy automatically pick the next available port
max_attempts = 30
current_port = requested_port
httpd = None

for attempt in range(max_attempts):
    try:
        httpd = ReusableTCPServer(("", current_port), http.server.SimpleHTTPRequestHandler)
        break
    except OSError as err:
        if err.errno == 98: # Address already in use
            current_port += 1
        else:
            print(f"Ошибка привязки сокета: {err}")
            sys.exit(1)

if not httpd:
    print(f"❌ Не удалось найти свободный порт в диапазоне {requested_port}–{requested_port + max_attempts}")
    sys.exit(1)

print("==========================================================")
print("  💳 BUDGET PLANNER — Сервер успешно запущен!")
print(f"  🌐 Адрес: http://localhost:{current_port}")
if current_port != requested_port:
    print(f"  ℹ️  Порт {requested_port} был занят, автоматически выбран свободный порт {current_port}")
print("  ⏹️  Нажмите Ctrl+C для остановки")
print("==========================================================")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nСервер остановлен.")
    httpd.server_close()
