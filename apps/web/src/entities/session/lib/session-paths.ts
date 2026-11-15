export function sessionPath(sessionId: string): string {
  return `/sessions/${sessionId}`;
}

export function reportPath(sessionId: string): string {
  return `${sessionPath(sessionId)}/report`;
}
