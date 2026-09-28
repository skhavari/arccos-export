import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { authenticateArccos, type ArccosAuthResult, type PasswordCredentials, type StoredAccessKey } from './arccos_auth';

// Load environment variables from .env file
dotenv.config();

const BASE_URL = 'https://api.arccosgolf.com';

// Basic interfaces
interface RoundSummary {
    roundId: number;
    [key: string]: unknown;
}

interface RoundDetail {
    roundId: number;
    [key: string]: unknown;
}

type AuthConfig = StoredAccessKey | PasswordCredentials;

// Holds the current JWT and renews it once when the API returns 401
class ArccosSession {
    private config: AuthConfig;
    private auth: ArccosAuthResult | undefined;

    constructor(config: AuthConfig) {
        this.config = config;
    }

    private async authenticate(): Promise<ArccosAuthResult> {
        const auth = await authenticateArccos(this.config);
        if (auth.accessKey && auth.secret) {
            // Password login issued a new access key; reuse it for renewals instead of issuing another
            this.config = { userId: auth.userId, accessKey: auth.accessKey, secret: auth.secret };
            console.log('🔑 Issued a new Arccos access key. Add these to .env to skip password login next time:');
            console.log(`ARCCOS_USER_ID=${auth.userId}\nARCCOS_ACCESS_KEY=${auth.accessKey}\nARCCOS_SECRET=${auth.secret}`);
        }
        return auth;
    }

    private async currentAuth(): Promise<ArccosAuthResult> {
        this.auth ??= await this.authenticate();
        return this.auth;
    }

    async request<T>(operation: (auth: ArccosAuthResult) => Promise<T>): Promise<T> {
        try {
            return await operation(await this.currentAuth());
        } catch (error: unknown) {
            if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
            this.auth = await this.authenticate();
            return operation(this.auth);
        }
    }
}

function authConfigFromEnv(): AuthConfig {
    const accessKey = process.env.ARCCOS_ACCESS_KEY;
    const secret = process.env.ARCCOS_SECRET;
    const userId = process.env.ARCCOS_USER_ID;
    if (accessKey && secret && userId) return { userId, accessKey, secret };

    const email = process.env.ARCCOS_USERNAME ?? process.env.ARCCOS_EMAIL;
    const password = process.env.ARCCOS_PASSWORD;
    if (email && password) return { email, password };

    throw new Error(
        'Missing Arccos login configuration. Set ARCCOS_ACCESS_KEY, ARCCOS_SECRET, and ARCCOS_USER_ID (preferred), or ARCCOS_USERNAME and ARCCOS_PASSWORD. ARCCOS_EMAIL is accepted as an alias for ARCCOS_USERNAME.',
    );
}

function authHeader(token: string) {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
            Accept: '*/*',
            'User-Agent': 'Arccos/620158 CFNetwork/3860.500.112 Darwin/25.4.0',
        },
    };
}

// Fetch all round summaries
async function fetchAllRounds(session: ArccosSession, limit = 50): Promise<RoundSummary[]> {
    const allRounds: RoundSummary[] = [];
    let offset = 0;
    let total: number | null = null;

    while (total === null || offset < total) {
        const data = await session.request(async ({ token, userId }) => {
            const url = `${BASE_URL}/v2/users/${userId}/rounds?limit=${limit}&offSet=${offset}&roundType=flagship`;
            return (await axios.get<{ rounds?: RoundSummary[]; totalCount?: number }>(url, authHeader(token))).data;
        });
        const rounds = data.rounds || [];
        total = data.totalCount ?? rounds.length;
        allRounds.push(...rounds);
        offset += rounds.length;
        if (rounds.length === 0) break;
    }

    await saveRounds(allRounds);
    return allRounds;
}

// Fetch full detail for a single round
async function fetchRoundDetail(session: ArccosSession, roundId: number): Promise<RoundDetail> {
    return session.request(async ({ token, userId }) => {
        const url = `${BASE_URL}/users/${userId}/rounds/${roundId}`;
        return (await axios.get<RoundDetail>(url, authHeader(token))).data;
    });
}

// Save all round summaries to a single file
async function saveRounds(allRounds: RoundSummary[]): Promise<void> {
    const dir = 'data';
    await fs.mkdir(dir, { recursive: true });
    const filename = path.join(dir, 'rounds.json');
    await fs.writeFile(filename, JSON.stringify(allRounds, null, 2));
    console.log(`✅ Saved summary: ${filename}`);
}

// Save full detail for one round
async function saveRound(roundData: RoundDetail): Promise<void> {
    const dir = 'data';
    await fs.mkdir(dir, { recursive: true });
    const filename = path.join(dir, `round_${roundData.roundId}.json`);
    await fs.writeFile(filename, JSON.stringify(roundData, null, 2));
    console.log(`📄 Saved detail: ${filename}`);
}

// Main logic
async function run(): Promise<void> {
    try {
        const session = new ArccosSession(authConfigFromEnv());

        console.log('📡 Fetching all rounds...');
        const rounds = await fetchAllRounds(session);
        console.log(`✅ Found ${rounds.length} rounds.`);

        for (const round of rounds) {
            const detail = await fetchRoundDetail(session, round.roundId);
            await saveRound(detail);
        }

        console.log('🏁 Done.');
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.error('❌ Error: Arccos rejected the newly issued token; verify the stored access key/secret or login credentials.');
        } else {
            console.error('❌ Error:', error instanceof Error ? error.message : error);
        }
        process.exitCode = 1;
    }
}

run();
