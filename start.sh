#!/bin/bash
# ShrimpAtlas 启动脚本
# 用法: ./start.sh [backend|frontend|db|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ACTION="${1:-all}"

start_db() {
    echo "🌊 启动 PostgreSQL + PostGIS..."
    docker-compose up -d db
    echo "✅ 数据库已启动 (localhost:5432)"
    echo "   用户: shrimpatlas / 密码: shrimpatlas123"
    echo "   数据库: shrimpatlas"
}

start_backend() {
    echo "⚙️ 启动 FastAPI 后端..."
    cd backend
    DATABASE_URL="postgresql+asyncpg://shrimpatlas:shrimpatlas123@localhost:5432/shrimpatlas" \
        venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    cd ..
    echo "✅ 后端已启动 (http://localhost:8000)"
    echo "   API 文档: http://localhost:8000/docs"
}

start_frontend() {
    echo "🎨 启动前端开发服务器..."
    cd frontend && npm run dev &
    cd ..
    echo "✅ 前端已启动 (http://localhost:5173)"
}

case "$ACTION" in
    db)
        start_db
        ;;
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    all)
        start_db
        sleep 3
        start_backend
        sleep 2
        start_frontend
        echo ""
        echo "🎉 ShrimpAtlas 全部启动！"
        echo "   前端: http://localhost:5173"
        echo "   后端: http://localhost:8000"
        echo "   API 文档: http://localhost:8000/docs"
        ;;
    *)
        echo "用法: $0 [backend|frontend|db|all]"
        ;;
esac
