# submail-ts

[![npm version](https://img.shields.io/npm/v/submail-ts.svg?style=flat-square)](https://www.npmjs.com/package/submail-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-green.svg?style=flat-square)](https://nodejs.org/)

SUBMAIL 赛邮云短信 [Node.js](https://nodejs.org/) SDK：模板短信 `xsend` 发送 + `SUBHOOK` 回调签名校验。

- 🚀 **零运行时依赖** —— 仅使用 Node.js 内置模块（`node:crypto`、`fetch`），无需任何第三方包
- 📘 **TypeScript 原生** —— 完整的类型定义与智能提示
- 📦 **双模块格式** —— 同时支持 ESM（`import`）与 CJS（`require`）
- 🔐 **多种签名方式** —— 支持 `normal` / `md5` / `sha1` 数字签名及 `sign_version 2`

## 环境要求

- Node.js >= 18（依赖内置 `fetch`）

## 安装

```bash
npm install submail-ts
```

## 快速开始

```ts
import Submail from 'submail-ts';

const submail = new Submail({
    appId: 'your_app_id',      // SUBMAIL 应用 ID
    appKey: 'your_app_key',    // SUBMAIL 应用密钥
});

const result = await submail.xsend({
    to: '13800138000',         // 收件人手机号
    project: 'ThJ862',         // 短信模板 ID
    vars: { code: '582713' },  // 模板变量
});

if (result.status === 'success') {
    console.log('发送成功，send_id:', result.send_id);
} else {
    console.error('发送失败：', result.code, result.msg);
}
```

CommonJS 项目同样支持：

```js
const Submail = require('submail-ts');
```

## API

### 构造函数

```ts
new Submail(options)
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `appId` | `string` | ✅ | - | 应用 ID（[SUBMAIL 控制台](https://www.mysubmail.com/) 获取） |
| `appKey` | `string` | ✅ | - | 应用密钥 |
| `signType` | `'normal' \| 'md5' \| 'sha1'` | ❌ | `'normal'` | 签名方式，见[签名说明](#签名说明) |
| `signVersion` | `string` | ❌ | - | 签名版本，传 `'2'` 时 `vars` 不参与签名 |

### 发送模板短信 `xsend()`

调用 [sms/xsend](https://www.mysubmail.com/documents/OOVyh) 接口发送模板短信。

```ts
submail.xsend(params): Promise<SubmailResult>
```

**参数 `params`：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `to` | `string` | ✅ | 收件人手机号 |
| `project` | `string` | ✅ | 短信模板 ID |
| `vars` | `Record<string, string>` | ❌ | 模板变量，如 `{ code: '582713' }` |
| `tag` | `string` | ❌ | 自定义标签，用于 SUBHOOK 追踪（32 字符以内） |

**返回值 `SubmailResult`：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | `'success' \| 'error'` | 发送状态 |
| `send_id` | `string` | 发送标识（成功时返回，可用于 SUBHOOK 比对） |
| `fee` | `number` | 计费条数（成功时返回） |
| `code` | `string` | 错误码（失败时返回） |
| `msg` | `string` | 错误描述（失败时返回） |

**示例：**

```ts
const result = await submail.xsend({
    to: '13800138000',
    project: 'ThJ862',
    vars: { code: '582713', expire: '5' },
    tag: 'login-otp', // 自定义标签，回调时可原样收到
});

if (result.status === 'error') {
    throw new Error(`[${result.code}] ${result.msg}`);
}
```

### 校验 SUBHOOK 回调签名 `verify()`

`SUBHOOK` 是 SUBMAIL 的推送回调机制（短信送达、失败等事件会以 GET/POST 推送到你配置的地址）。推送参数中包含 `signature` 与 `token`，用此方法验证回调真实性，防止伪造请求。

```ts
submail.verify(params: Record<string, string>): boolean
```

以 Express 为例：

```ts
import express from 'express';
import Submail from 'submail-ts';

const submail = new Submail({ appId: 'your_app_id', appKey: 'your_app_key' });
const app = express();

app.get('/webhook/submail', (req, res) => {
    if (!submail.verify(req.query as Record<string, string>)) {
        return res.status(403).send('invalid signature');
    }
    // 验签通过，处理送达/失败事件
    console.log(req.query.action, req.query.send_id);
    res.send('ok');
});
```

## 签名说明

SDK 支持三种签名方式，详见 [SUBMAIL 签名文档](https://www.mysubmail.com/documents/VBcbe)：

| `signType` | 模式 | 说明 |
| --- | --- | --- |
| `normal` | 明文密钥 | `signature` 直接传 `appKey`，仅建议开发调试使用 |
| `md5` | 数字签名 | 参数按 key 升序拼接后做 MD5 哈希 |
| `sha1` | 数字签名 | 同上，使用 SHA1 哈希 |

**推荐生产环境使用 `md5` 或 `sha1`：**

```ts
const submail = new Submail({
    appId: 'your_app_id',
    appKey: 'your_app_key',
    signType: 'md5',
});
```

数字签名规则：将请求参数（不含 `signature`、`tag`）按 key 升序排列为 `key=value&key=value` 形式，前后拼接 `appid` 与 `appkey`，再做相应哈希。`signVersion` 传 `'2'` 时 `vars` 参数不参与签名计算。

## 开发

```bash
npm install     # 安装依赖
npm run build   # 构建产物（ESM + CJS + 类型声明）至 dist/
```

发布新版本（自动递增版本号、打 git tag 并构建发布）：

```bash
npm run release        # 1.0.0 -> 1.0.1（修订版本）
npm run release:minor  # 1.0.1 -> 1.1.0（次版本）
npm run release:major  # 1.1.0 -> 2.0.0（主版本）
```

## 许可证

[MIT](LICENSE)
