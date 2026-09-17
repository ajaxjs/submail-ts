import { createHash } from 'node:crypto';

/** Submail 短信发送返回 */
interface SubmailResult {
    status: 'success' | 'error';
    send_id?: string;
    fee?: number;
    code?: string;
    msg?: string;
}

/** xsend 请求参数 */
interface XSendParams {
    /** 收件人手机号 */
    to: string;
    /** 短信模板 ID */
    project: string;
    /** 模板变量 */
    vars?: Record<string, string>;
    /** 自定义标签，用于 SUBHOOK 追踪（32字符以内） */
    tag?: string;
}

interface SubmailOptions {
    appId: string;
    appKey: string;
    signType?: 'normal' | 'md5' | 'sha1';
    signVersion?: string;
}

/**
 * SUBMAIL 赛邮云短信发送
 * API文档：https://www.mysubmail.com/documents/OOVyh
 */
export default class Submail {
    private readonly appId: string;
    private readonly appKey: string;
    /** 签名方式：normal=明文密钥 | md5 | sha1 */
    private readonly signType: 'normal' | 'md5' | 'sha1';
    /** 签名计算版本，传 2 时 vars 不参与加密 */
    private readonly signVersion?: string;
    /** API 基础地址 */
    private readonly baseUrl = 'https://api-v4.mysubmail.com';

    constructor(opts: SubmailOptions) {
        this.appId = opts.appId;
        this.appKey = opts.appKey;
        this.signType = opts?.signType || 'normal';
        this.signVersion = opts?.signVersion;

        if (!this.appId || !this.appKey) {
            throw new Error('SUBMAIL_APP_ID 和 SUBMAIL_HOOK_KEY 未配置');
        }
    }

    /**
     * 发送模板短信（sms/xsend）
     */
    async xsend(params: XSendParams): Promise<SubmailResult> {
        const body: Record<string, string> = {
            appid: this.appId,
            to: params.to,
            project: params.project,
        };

        // 模板变量
        if (params.vars && Object.keys(params.vars).length > 0) {
            body.vars = JSON.stringify(params.vars);
        }

        // 自定义标签
        if (params.tag) {
            body.tag = params.tag;
        }

        // 签名类型
        body.sign_type = this.signType;

        // 签名版本
        if (this.signVersion) {
            body.sign_version = this.signVersion;
        }

        // 计算 signature
        body.signature = this.calcSignature(body);

        const url = `${this.baseUrl}/sms/xsend.json`;

        const res: SubmailResult = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then((res) => res.json());

        return res;
    }

    /**
     * 验证SUBHOOK回调签名
     * @param params SUBHOOK回调参数
     * @returns 
     */
    verify(params: Record<string, string>): boolean {
        const { signature, token } = params;
        return signature === createHash('md5').update(token + this.appKey).digest('hex');
    }

    /**
     * 计算签名
     * - normal：直接返回 appKey（明文密钥模式）
     * - md5/sha1：数字签名模式
     *
     * 签名规则（参阅 https://www.mysubmail.com/documents/VBcbe）：
     * 1. 将所有参数（不含 signature、tag、sms_signature）按 key 升序排列
     * 2. 以 key=value&key=value 方式拼接
     * 3. 前后拼接 appid 和 appkey：appid + appkey + paramString + appid + appkey
     * 4. 对拼接后的字符串做 md5 或 sha1
     */
    private calcSignature(body: Record<string, string>): string {
        if (this.signType === 'normal') {
            return this.appKey;
        }

        // 不参与签名的字段
        const excludeKeys = new Set(['signature', 'tag', 'sms_signature']);

        // sign_version=2 时 vars 不参与加密
        if (this.signVersion === '2') {
            excludeKeys.add('vars');
        }

        // 1. 过滤并升序排列
        const sortedKeys = Object.keys(body)
            .filter((k) => !excludeKeys.has(k))
            .sort();

        // 2. 拼接参数串
        const paramString = sortedKeys.map((k) => `${k}=${body[k]}`).join('&');

        // 3. 前后拼接 appid + appkey
        const signStr = this.appId + this.appKey + paramString + this.appId + this.appKey;

        // 4. 哈希
        return createHash(this.signType).update(signStr).digest('hex');
    }
}
