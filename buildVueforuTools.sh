#!/bin/bash
# 导出项目
npm run build
# 移动到插件文件夹
if [ "$?" -eq 0 ];then
    rm -r ./ui/*
    mv ./dist/* ./ui/
    rm -r ./dist
fi
cp logo.png ./ui/assets/favicon.png
