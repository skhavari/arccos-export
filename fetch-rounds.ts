import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const BASE_URL = 'https://api.arccosgolf.com';
const TOKEN = process.env.ARCCOS_BEARER_TOKEN;
const USER_ID = process.env.ARCCOS_USER_ID;

if (!TOKEN || !USER_ID) {
    console.error('Missing ARCCOS_BEARER_TOKEN or ARCCOS_USER_ID in .env');
    process.exit(1);
}

const AUTH_HEADER = {
    headers: {
        Authorization: `Bearer: ${TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
    },
};

// Basic interfaces
interface RoundSummary {
    roundId: number;
    [key: string]: any;
}

interface RoundDetail {
    roundId: number;
    [key: string]: any;
}

// Fetch all round summaries
async function fetchAllRounds(limit = 50): Promise<RoundSummary[]> {
    const allRounds: RoundSummary[] = [];
    let offset = 0;
    let total: number | null = null;

    while (total === null || offset < total) {
        const url = `${BASE_URL}/v2/users/${USER_ID}/rounds?limit=${limit}&offSet=${offset}&roundType=flagship`;
        const { data } = await axios.get(url, AUTH_HEADER);
        const rounds: RoundSummary[] = data.rounds || [];
        total = data.totalCount ?? rounds.length;
        allRounds.push(...rounds);
        offset += rounds.length;
        if (rounds.length === 0) break;
    }

    await saveRounds(allRounds);
    return allRounds;
}

// Fetch full detail for a single round
async function fetchRoundDetail(roundId: number): Promise<RoundDetail> {
    const url = `${BASE_URL}/users/${USER_ID}/rounds/${roundId}`;
    const { data } = await axios.get(url, AUTH_HEADER);
    return data;
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
        console.log('📡 Fetching all rounds...');
        const rounds = await fetchAllRounds();
        console.log(`✅ Found ${rounds.length} rounds.`);

        for (const round of rounds) {
            const detail = await fetchRoundDetail(round.roundId);
            await saveRound(detail);
        }

        console.log('🏁 Done.');
    } catch (err: any) {
        console.error('❌ Error:', err.message ?? err);
    }
}

run();
