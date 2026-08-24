#!/usr/bin/env bash
# 打包 uTools 插件到 release/（文件清单与当前 release/ 目录一致）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RELEASE="$ROOT/release"

cd "$ROOT"

echo "==> 构建前端 (vite -> ui/)"
npm run build
rm -rf ui/*
cp -a dist/* ui/
rm -rf dist
cp -f logo.png ui/assets/favicon.png
sed -i 's/ crossorigin//g' ui/index.html

if [[ ! -d node_modules ]]; then
  echo "错误: 未找到 node_modules，请先 npm install" >&2
  exit 1
fi

echo "==> 清空 release/"
rm -rf "$RELEASE"
mkdir -p "$RELEASE"

echo "==> 复制插件文件"
cp -a \
  index.html \
  LICENSE \
  logo.png \
  package.json \
  package-lock.json \
  plugin.json \
  public \
  src \
  tspreload.js \
  ui \
  vite.config.js \
  "$RELEASE/"

echo "==> 复制 node_modules（不含 .map / .js.gz）"
mkdir -p "$RELEASE/node_modules"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude='*.map' --exclude='*.js.gz' node_modules/ "$RELEASE/node_modules/"
else
  cp -a node_modules/. "$RELEASE/node_modules/"
  mapfile -t PRUNE < <(find "$RELEASE/node_modules" -type f \( -name '*.map' -o -name '*.js.gz' \) -print)
  if ((${#PRUNE[@]})); then
    find "$RELEASE/node_modules" -type f \( -name '*.map' -o -name '*.js.gz' \) -delete
  fi
  echo "    已删除 ${#PRUNE[@]} 个 .map / .js.gz 文件"
fi

echo ""
echo "打包完成: $RELEASE"
echo "请把 release/ 里的内容（不是 release 文件夹本身）打成 zip 安装。"
du -sh "$RELEASE" "$RELEASE/node_modules"
