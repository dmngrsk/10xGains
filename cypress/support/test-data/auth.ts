export function generateTestEmail(prefix: string): string {
  const timestamp = new Date();
  const pad = (n: number, length: number = 2) => n.toString().padStart(length, '0');

  const formattedDate = timestamp.getFullYear().toString() +
    pad(timestamp.getMonth() + 1) +
    pad(timestamp.getDate()) +
    pad(timestamp.getHours()) +
    pad(timestamp.getMinutes()) +
    pad(timestamp.getSeconds()) +
    pad(timestamp.getMilliseconds(), 3);

  return `${prefix}-${formattedDate}@10xgains.com`;
}
  
export function generateTestPassword(): string {
  return Math.random().toString(36).substring(2, 15) + 'Aa1!';
}
