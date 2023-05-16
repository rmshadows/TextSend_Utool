#!/bin/bash
# 导出项目
npm run build
# 移动到插件文件夹
if [ "$?" -eq 0 ];then
    rm -r ../utools_plugin/dist_bak/*
    cp -r ../utools_plugin/dist/ ../utools_plugin/dist_bak/
    mv ./dist/ ../utools_plugin/dist/
fi
