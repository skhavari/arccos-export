import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { ArccosSession, fileCache, type Credentials } from './arccos.ts';

// Load environment variables from .env file
dotenv.config({ quiet: true });

// Saved Arccos access key and token, so later runs skip signing in
const SESSION_CACHE = '.arccos-session.json';

// Basic interfaces
interface RoundSummary {
    roundId: number;
    [key: string]: unknown;
}

interface RoundDetail {
    roundId: number;
    [key: string]: unknown;
}

function credentialsFromEnv(): Credentials {
    const email = process.env.ARCCOS_USERNAME;
    const password = process.env.ARCCOS_PASSWORD;
    if (!email || !password) throw new Error('Missing ARCCOS_USERNAME or ARCCOS_PASSWORD in .env');
    return { email, password };
}

// Fetch all round summaries
async function fetchAllRounds(session: ArccosSession, limit = 50): Promise<RoundSummary[]> {
    const allRounds: RoundSummary[] = [];
    let offset = 0;
    let total: number | null = null;

    while (total === null || offset < total) {
        const data = await session.get<{ rounds?: RoundSummary[]; totalCount?: number }>(
            (userId) => `/v2/users/${userId}/rounds?limit=${limit}&offSet=${offset}&roundType=flagship`,
        );
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
function fetchRoundDetail(session: ArccosSession, roundId: number): Promise<RoundDetail> {
    return session.get<RoundDetail>((userId) => `/users/${userId}/rounds/${roundId}`);
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
        const session = new ArccosSession(credentialsFromEnv(), { cache: fileCache(SESSION_CACHE) });

        console.log('📡 Fetching all rounds...');
        const rounds = await fetchAllRounds(session);
        console.log(`✅ Found ${rounds.length} rounds.`);

        for (const round of rounds) {
            const detail = await fetchRoundDetail(session, round.roundId);
            await saveRound(detail);
        }

        console.log('🏁 Done.');
    } catch (error: unknown) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

run();
