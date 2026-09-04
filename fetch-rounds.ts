import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { authenticateArccos, type ArccosAuthResult, type PasswordCredentials, type StoredAccessKey } from './arccos_auth';

dotenv.config();

const BASE_URL = 'https://api.arccosgolf.com';

interface RoundSummary {
  roundId: number;
  [key: string]: unknown;
}

interface RoundDetail {
  roundId: number;
  [key: string]: unknown;
}

type AuthConfig = StoredAccessKey | PasswordCredentials;

class ArccosSession {
  private auth: ArccosAuthResult | undefined;

  constructor(private readonly config: AuthConfig) {}

  private async currentAuth(): Promise<ArccosAuthResult> {
    this.auth ??= await authenticateArccos(this.config);
    return this.auth;
  }

  async request<T>(operation: (auth: ArccosAuthResult) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.currentAuth());
    } catch (error: unknown) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      this.auth = await authenticateArccos(this.config);
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

async function fetchAllRounds(session: ArccosSession, limit = 50): Promise<RoundSummary[]> {
  const allRounds: RoundSummary[] = [];
  let offset = 0;
  let total: number | null = null;
  while (total === null || offset < total) {
    const data = await session.request(async ({ token, userId }) => {
      const url = `${BASE_URL}/users/${userId}/rounds?limit=${limit}&offSet=${offset}&roundType=flagship`;
      return (await axios.get<{ rounds?: RoundSummary[]; totalCount?: number }>(url, authHeader(token))).data;
    });
    const rounds = data.rounds || [];
    total = data.totalCount ?? rounds.length;
    allRounds.push(...rounds);
    offset += rounds.length;
    if (rounds.length === 0) break;
  }
  return allRounds;
}

async function fetchRoundDetail(session: ArccosSession, roundId: number): Promise<RoundDetail> {
  return session.request(async ({ token, userId }) => {
    const url = `${BASE_URL}/users/${userId}/rounds/${roundId}`;
    return (await axios.get<RoundDetail>(url, authHeader(token))).data;
  });
}

async function saveRounds(rounds: RoundSummary[]): Promise<void> {
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(path.join('data', 'rounds.json'), JSON.stringify(rounds, null, 2));
}

async function saveRound(round: RoundDetail): Promise<void> {
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(path.join('data', `round_${round.roundId}.json`), JSON.stringify(round, null, 2));
}

async function downloadWithToken(session: ArccosSession): Promise<void> {
  const rounds = await fetchAllRounds(session);
  console.log(`Found ${rounds.length} rounds.`);
  await saveRounds(rounds);
  for (const round of rounds) await saveRound(await fetchRoundDetail(session, round.roundId));
}

async function run(): Promise<void> {
  try {
    await downloadWithToken(new ArccosSession(authConfigFromEnv()));
    console.log('Arccos round export complete.');
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error('Arccos rejected the newly issued token; verify the stored access key/secret or login credentials.');
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}

run();
