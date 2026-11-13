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
