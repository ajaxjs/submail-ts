import { defineConfig } from 'tsup';

export default defineConfig({
    // 入口文件
    entry: ['src/index.ts'],
    // 同时产出 ESM (dist/index.js) 和 CJS (dist/index.cjs)
    format: ['esm', 'cjs'],
    // 自动生成 .d.ts 类型声明
    dts: true,
    // 生成 sourcemap，便于使用方调试
    sourcemap: true,
    // 目标运行环境：Node 18+
    target: 'node18',
    // 每次构建前清空 dist 目录
    clean: true,
});
