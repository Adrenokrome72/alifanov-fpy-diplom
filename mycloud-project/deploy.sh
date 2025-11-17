#!/bin/bash

# Скрипт развертывания MyCloud
# Этот скрипт помогает развернуть приложение MyCloud с использованием Docker Compose

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$PROJECT_DIR/infra/docker-compose.yml"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Без цвета

# Функции
log_info() {
    echo -e "${BLUE}[ИНФО]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[УСПЕХ]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[ПРЕДУПРЕЖДЕНИЕ]${NC} $1"
}

log_error() {
    echo -e "${RED}[ОШИБКА]${NC} $1"
}

install_dependencies() {
    log_info "Проверка и установка зависимостей..."

    # Проверка и установка Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker не установлен. Устанавливаю Docker..."
        if command -v apt-get &> /dev/null; then
            # Ubuntu/Debian
            sudo apt-get update
            sudo apt-get install -y ca-certificates curl gnupg lsb-release
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        elif command -v dnf &> /dev/null; then
            # Fedora
            sudo dnf -y install dnf-plugins-core
            sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        else
            log_error "Не удалось определить менеджер пакетов. Установите Docker вручную."
            exit 1
        fi
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
        log_success "Docker установлен. Перезайдите в систему или выполните 'newgrp docker' для применения изменений."
    else
        log_success "Docker уже установлен"
    fi

    # Проверка и установка Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_warning "Docker Compose не установлен. Устанавливаю Docker Compose..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y docker-compose-plugin
        elif command -v yum &> /dev/null; then
            sudo yum install -y docker-compose-plugin
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y docker-compose-plugin
        else
            # Fallback: install standalone docker-compose
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
        fi
        log_success "Docker Compose установлен"
    else
        log_success "Docker Compose уже установлен"
    fi

    # Проверка curl (нужен для проверки сервисов)
    if ! command -v curl &> /dev/null; then
        log_warning "curl не установлен. Устанавливаю curl..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get install -y curl
        elif command -v yum &> /dev/null; then
            sudo yum install -y curl
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y curl
        fi
        log_success "curl установлен"
    fi

    log_success "Проверка зависимостей завершена"
}

check_dependencies() {
    install_dependencies
}

check_env_file() {
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_warning "Файл .env не найден. Создаю из .env.example..."
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            log_warning "Пожалуйста, отредактируйте файл .env с вашей конфигурацией перед продолжением!"
            log_warning "Как минимум, измените секретный ключ Django и пароль базы данных."
            read -p "Нажмите Enter для продолжения после редактирования .env..."
        else
            log_error "Файл .env.example не найден. Создайте .env вручную."
            exit 1
        fi
    fi
}

build_and_start() {
    log_info "Сборка и запуск сервисов..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" up --build -d

    log_success "Сервисы запущены успешно"
}

wait_for_services() {
    log_info "Ожидание готовности сервисов..."

    # Ожидание базы данных
    log_info "Ожидание базы данных..."
    docker-compose -f "$COMPOSE_FILE" exec -T db sh -c 'while ! pg_isready -U ${DB_USER} -d ${DB_NAME}; do sleep 1; done'

    # Ожидание бэкенда
    log_info "Ожидание бэкенда..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T backend curl -f http://localhost:8000/api/health/ &> /dev/null; then
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done

    if [ $timeout -le 0 ]; then
        log_error "Бэкенд не запустился в ожидаемое время"
        exit 1
    fi

    # Ожидание фронтенда
    log_info "Ожидание фронтенда..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:3000 &> /dev/null; then
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done

    if [ $timeout -le 0 ]; then
        log_error "Фронтенд не запустился в ожидаемое время"
        exit 1
    fi

    log_success "Все сервисы готовы"
}

show_status() {
    log_info "Статус сервисов:"
    docker-compose -f "$COMPOSE_FILE" ps

    echo ""
    log_info "URL для доступа:"
    echo "  Фронтенд:    http://localhost:3000"
    echo "  API бэкенда: http://localhost:8000"
    echo "  Админ-панель: http://localhost/admin/"
    echo "  Nginx:       http://localhost"
}

stop_services() {
    log_info "Остановка сервисов..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Сервисы остановлены"
}

restart_services() {
    log_info "Перезапуск сервисов..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" restart
    wait_for_services
    log_success "Сервисы перезапущены"
}

show_logs() {
    log_info "Показ логов сервисов..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

cleanup() {
    log_info "Очистка ресурсов Docker..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down -v --rmi all
    docker system prune -f
    log_success "Очистка завершена"
}

show_help() {
    echo "Скрипт развертывания MyCloud"
    echo ""
    echo "Использование: $0 [КОМАНДА]"
    echo ""
    echo "Команды:"
    echo "  start     Сборка и запуск всех сервисов"
    echo "  stop      Остановка всех сервисов"
    echo "  restart   Перезапуск всех сервисов"
    echo "  status    Показ статуса сервисов и URL для доступа"
    echo "  logs      Показ логов сервисов"
    echo "  cleanup   Удаление всех контейнеров, томов и образов"
    echo "  help      Показ этого сообщения помощи"
    echo ""
    echo "Примеры:"
    echo "  $0 start"
    echo "  $0 stop"
    echo "  $0 logs"
}

# Main script
case "${1:-start}" in
    start)
        check_dependencies
        check_env_file
        build_and_start
        wait_for_services
        show_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Неизвестная команда: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
