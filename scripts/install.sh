#!/usr/bin/env bash
# WebCraft one-liner install script
# Usage: curl -fsSL https://raw.githubusercontent.com/Kofysh/webcraft/main/scripts/install.sh | bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}\n🧱 WebCraft Installer${NC}\n"

# 1. Check Node.js >= 18
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}Node.js not found. Installing via nvm...${NC}"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js >= 18 required (found $NODE_MAJOR). Please upgrade."
  exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# 2. Clone repo
if [ -d webcraft ]; then
  echo "Directory 'webcraft' already exists — pulling latest changes..."
  cd webcraft && git pull
else
  git clone https://github.com/Kofysh/webcraft.git
  cd webcraft
fi

# 3. Install dependencies
npm install --omit=dev

# 4. Create .env from example if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠️  .env created from .env.example — edit it before starting!${NC}"
fi

# 5. Summary
echo -e "\n${GREEN}✅ WebCraft installed successfully!${NC}"
echo -e "\nTo start:\n  cd webcraft && node src/index.js\n"
echo -e "Players connect with:\n  npx webcraft-proxy ws://<your-ip>:8080\n"
