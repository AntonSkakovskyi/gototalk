import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { authorization } from './fixtures.js';

export interface SessionRecord {
  id: string;
  status: string;
  feedbackMode: string;
}

function isSessionRecord(value: unknown): value is SessionRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'status' in value &&
    typeof value.status === 'string' &&
    'feedbackMode' in value &&
    typeof value.feedbackMode === 'string'
  );
}

export async function readSession(
  request: APIRequestContext,
  accessToken: string,
  id: string,
): Promise<SessionRecord> {
  const response = await request.get(`/api/sessions/${id}`, {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'read session').toBe(200);
  const body: unknown = await response.json();
  if (!isSessionRecord(body)) {
    throw new Error('session response has an unexpected shape');
  }
  return body;
}

export async function listSessions(
  request: APIRequestContext,
  accessToken: string,
): Promise<SessionRecord[]> {
  const response = await request.get('/api/sessions', {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'list sessions').toBe(200);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isSessionRecord)) {
    throw new Error('session list response has an unexpected shape');
  }
  return body;
}

const SESSION_PATH = /^\/sessions\/([0-9a-f-]{36})$/;

export function sessionIdFromUrl(page: Page): string {
  const id = SESSION_PATH.exec(new URL(page.url()).pathname)?.[1];
  if (!id) {
    throw new Error(`not a session page: ${page.url()}`);
  }
  return id;
}

export interface MistakeRecord {
  category: string;
  isFalse: boolean;
}

export interface UtteranceRecord {
  role: string;
  text: string;
  analysisStatus: string;
  mistakes: MistakeRecord[];
}

export interface SessionDetailsRecord extends SessionRecord {
  utterances: UtteranceRecord[];
}

function isMistakeRecord(value: unknown): value is MistakeRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'category' in value &&
    typeof value.category === 'string' &&
    'isFalse' in value &&
    typeof value.isFalse === 'boolean'
  );
}

function isUtteranceRecord(value: unknown): value is UtteranceRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'role' in value &&
    typeof value.role === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'analysisStatus' in value &&
    typeof value.analysisStatus === 'string' &&
    'mistakes' in value &&
    Array.isArray(value.mistakes) &&
    value.mistakes.every(isMistakeRecord)
  );
}

export async function readSessionDetails(
  request: APIRequestContext,
  accessToken: string,
  id: string,
): Promise<SessionDetailsRecord> {
  const response = await request.get(`/api/sessions/${id}`, {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'read session details').toBe(200);
  const body: unknown = await response.json();
  if (
    !isSessionRecord(body) ||
    !('utterances' in body) ||
    !Array.isArray(body.utterances) ||
    !body.utterances.every(isUtteranceRecord)
  ) {
    throw new Error('session details response has an unexpected shape');
  }
  return { ...body, utterances: body.utterances };
}

export interface WeakAreaRecord {
  category: string;
  frequency: number;
}

function isWeakAreaRecord(value: unknown): value is WeakAreaRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'category' in value &&
    typeof value.category === 'string' &&
    'frequency' in value &&
    typeof value.frequency === 'number'
  );
}

export async function readWeakAreas(
  request: APIRequestContext,
  accessToken: string,
): Promise<WeakAreaRecord[]> {
  const response = await request.get('/api/profile/learner-model', {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'read learner model').toBe(200);
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('weakAreas' in body) ||
    !Array.isArray(body.weakAreas) ||
    !body.weakAreas.every(isWeakAreaRecord)
  ) {
    throw new Error('learner model response has an unexpected shape');
  }
  return body.weakAreas.map(({ category, frequency }) => ({
    category,
    frequency,
  }));
}
