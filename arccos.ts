import fs from 'node:fs/promises';

const AUTH_BASE = 'https://authentication.arccosgolf.com';
const API_BASE = 'https://api.arccosgolf.com';

// Headers the Arccos iOS app sends to both the auth service and the API
const HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: '*/*',
    'User-Agent': 'Arccos/620158 CFNetwork/3860.500.112 Darwin/25.4.0',
};

export type ArccosFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type Credentials = {
    email: string;
    password: string;
};

type AccessKey = {
    userId: string;
    accessKey: string;
    secret: string;
};

type Token = {
    userId: string;
    token: string;
};

// What's saved between runs so each run doesn't have to sign in again
export type CachedSession = {
    email: string;
    accessKey: AccessKey;
    token: Token;
};

export type SessionCache = {
    read(): Promise<CachedSession | undefined>;
    write(session: CachedSession): Promise<void>;
};

// Stores the session as JSON, readable only by the current user
export function fileCache(file: string): SessionCache {
    return {
        async read() {
            try {
                return JSON.parse(await fs.readFile(file, 'utf8')) as CachedSession;
            } catch {
                return undefined;
            }
        },
        async write(session) {
            await fs.writeFile(file, JSON.stringify(session, null, 2), { mode: 0o600 });
        },
    };
}

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

async function requestJson<T>(fetcher: ArccosFetch, url: string, init: RequestInit): Promise<T> {
    const response = await fetcher(url, init);
    if (!response.ok) {
        throw new HttpError(response.status, `${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
}

// Signs in with an email and password, and renews the short-lived JWT when the API returns 401.
// Signing in creates an access key on the account, so the key and JWT are cached and reused.
export class ArccosSession {
    private readonly credentials: Credentials;
    private readonly cache: SessionCache | undefined;
    private readonly fetcher: ArccosFetch;
    private cacheLoaded = false;
    private accessKey: AccessKey | undefined;
    private token: Token | undefined;

    constructor(credentials: Credentials, options: { cache?: SessionCache; fetcher?: ArccosFetch } = {}) {
        this.credentials = credentials;
        this.cache = options.cache;
        this.fetcher = options.fetcher ?? fetch;
    }

    // GET an API path built from the signed-in user's id, renewing the token and retrying once on 401
    async get<T>(path: (userId: string) => string): Promise<T> {
        await this.loadCache();
        const token = this.token ?? (await this.renewToken());
        try {
            return await this.getWithToken<T>(path, token);
        } catch (error: unknown) {
            if (!(error instanceof HttpError) || error.status !== 401) throw error;
            return this.getWithToken<T>(path, await this.renewToken());
        }
    }

    private getWithToken<T>(path: (userId: string) => string, { userId, token }: Token): Promise<T> {
        return requestJson<T>(this.fetcher, `${API_BASE}${path(userId)}`, {
            headers: { ...HEADERS, Authorization: `Bearer ${token}` },
        });
    }

    private async loadCache(): Promise<void> {
        if (this.cacheLoaded) return;
        this.cacheLoaded = true;
        const cached = await this.cache?.read();
        if (cached?.email !== this.credentials.email) return;
        this.accessKey = cached.accessKey;
        this.token = cached.token;
    }

    private async renewToken(): Promise<Token> {
        let token: Token | undefined;
        if (this.accessKey) {
            try {
                token = await this.exchangeAccessKey(this.accessKey);
            } catch (error: unknown) {
                if (!(error instanceof HttpError)) throw error;
                // The saved access key no longer works; sign in again below
            }
        }
        if (!token) {
            this.accessKey = await this.createAccessKey();
            token = await this.exchangeAccessKey(this.accessKey);
        }
        this.token = token;
        await this.cache?.write({ email: this.credentials.email, accessKey: this.accessKey!, token });
        return token;
    }

    private async exchangeAccessKey({ userId, accessKey, secret }: AccessKey): Promise<Token> {
        const token = await this.post<Token>('/tokens', { userId, accessKey, secret });
        if (!token.userId || !token.token) throw new Error('Arccos token response was incomplete.');
        return token;
    }

    private async createAccessKey(): Promise<AccessKey> {
        const key = await this.post<AccessKey>('/accessKeys', {
            email: this.credentials.email,
            password: this.credentials.password,
            isMetricUser: 'T',
            language: 'en_CA',
            signedInByFacebook: 'F',
        });
        if (!key.userId || !key.accessKey || !key.secret) throw new Error('Arccos access-key response was incomplete.');
        return key;
    }

    private post<T>(path: string, body: unknown): Promise<T> {
        return requestJson<T>(this.fetcher, `${AUTH_BASE}${path}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(body),
        });
    }
}
