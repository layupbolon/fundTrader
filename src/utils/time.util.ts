export function isTradeTime(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 周末不交易
  if (day === 0 || day === 6) {
    return false;
  }

  // 工作日15:00前
  if (hour < 15) {
    return true;
  }

  if (hour === 15 && minute === 0) {
    return true;
  }

  return false;
}

export function isWorkday(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
