#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 时光修复师启动脚本 ===${NC}"

# 1. 检查 node_modules 是否存在，不存在则安装
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}检测到未安装依赖，正在安装...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
fi

# 2. 执行构建
echo -e "${YELLOW}正在构建项目 (Build)...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm build
else
    npm run build
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}构建成功！${NC}"
else
    echo -e "\033[0;31m构建失败，请检查错误日志。${NC}"
    exit 1
fi

# 3. 启动服务
echo -e "${GREEN}正在启动预览服务 (Serve)...${NC}"
echo -e "${BLUE}访问地址: http://localhost:3000${NC}"

if command -v pnpm &> /dev/null; then
    pnpm serve
else
    npm run serve
fi
