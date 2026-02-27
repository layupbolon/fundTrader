/**
 * 判断当前是否为交易时间
 *
 * 场外基金交易时间规则：
 * - 交易日：工作日（周一至周五）
 * - 交易时段：09:00 - 15:00
 * - 15:00 前提交按当日净值成交
 * - 15:00 后提交按次日净值成交
 *
 * 注意事项：
 * - 不考虑节假日（需要接入节假日 API）
 * - 不考虑基金公司的特殊规定
 * - 实际应用中应该增加节假日判断
 *
 * @returns true 表示当前为交易时间，false 表示非交易时间
 *
 * @example
 * if (isTradeTime()) {
 *   // 执行定投或其他交易操作
 *   await executeTrade();
 * }
 */
export function isTradeTime(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 周末不交易
  if (day === 0 || day === 6) {
    return false;
  }

  // 工作日15:00前
  // 15:00 是交易截止时间
  if (hour < 15) {
    return true;
  }

  // 15:00:00 也算交易时间
  if (hour === 15 && minute === 0) {
    return true;
  }

  return false;
}

/**
 * 判断指定日期是否为工作日
 *
 * 简单判断：周一至周五为工作日，周六周日为休息日。
 * 不考虑节假日和调休。
 *
 * @param date 要判断的日期，默认为当前日期
 * @returns true 表示工作日，false 表示休息日
 *
 * @example
 * // 判断今天是否为工作日
 * if (isWorkday()) {
 *   console.log('今天是工作日');
 * }
 *
 * @example
 * // 判断指定日期是否为工作日
 * const date = new Date('2026-02-26');
 * if (isWorkday(date)) {
 *   console.log('该日期是工作日');
 * }
 */
export function isWorkday(date: Date = new Date()): boolean {
  const day = date.getDay();
  // 周一(1)到周五(5)为工作日
  return day !== 0 && day !== 6;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 *
 * 将 Date 对象转换为标准的日期字符串格式，用于 API 请求和数据库查询。
 *
 * @param date 要格式化的日期
 * @returns YYYY-MM-DD 格式的日期字符串
 *
 * @example
 * const date = new Date('2026-02-26T10:30:00');
 * const formatted = formatDate(date);
 * // 返回: '2026-02-26'
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要+1
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 异步延迟函数
 *
 * 返回一个 Promise，在指定毫秒数后 resolve。
 * 用于在异步流程中添加延迟，如限流、重试等待等。
 *
 * @param ms 延迟的毫秒数
 * @returns Promise，在指定时间后 resolve
 *
 * @example
 * // 延迟 1 秒后继续执行
 * await sleep(1000);
 * console.log('1秒后执行');
 *
 * @example
 * // 重试逻辑中使用
 * for (let i = 0; i < 3; i++) {
 *   try {
 *     await fetchData();
 *     break;
 *   } catch (error) {
 *     if (i < 2) await sleep(1000); // 重试前等待1秒
 *   }
 * }
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 将配置中的星期几转换为 JavaScript 的 getDay() 格式
 *
 * 配置格式：1-7（1=周一，2=周二，...，7=周日）
 * JS getDay()：0-6（0=周日，1=周一，...，6=周六）
 *
 * 转换公式：configDay % 7
 * - 1 → 1 (Monday)
 * - 2 → 2 (Tuesday)
 * - 3 → 3 (Wednesday)
 * - 4 → 4 (Thursday)
 * - 5 → 5 (Friday)
 * - 6 → 6 (Saturday)
 * - 7 → 0 (Sunday)
 *
 * @param configDay 配置中的星期几（1-7）
 * @returns JavaScript getDay() 格式的星期几（0-6）
 */
export function configDayToJsDay(configDay: number): number {
  return configDay % 7;
}
