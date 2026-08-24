#!/bin/bash

set -uex
# 生成导出文件夹
prelease="DEBUG_RELEASE"

if ! [ -d "$prelease" ];then
  mkdir "$prelease"
else
  rm -r "$prelease"
  mkdir "$prelease"
fi
# 复制文件
cp -r "ui" "$prelease"
cp -r "imgs" "$prelease"
cp -r "node_modules" "$prelease"
cp -r "public" "$prelease"
cp -r "src" "$prelease"
cp "package.json" "$prelease"
cp "package-lock.json" "$prelease"
cp "README.md" "$prelease"
cp "tspreload.js" "$prelease"
cp "plugin.jso"n "$prelease"
cp "logo.pn"g "$prelease"
cp "LICENSE" "$prelease"
cp "index.html" "$prelease"
rm -r "$prelease"/src/nodejs/test
cp -r "$prelease" RELEASE

