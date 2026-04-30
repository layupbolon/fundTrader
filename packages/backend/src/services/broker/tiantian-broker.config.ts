export interface TiantianBrokerSelectors {
  usernameInput: string;
  passwordInput: string;
  loginButton: string;
  amountInput: string;
  buyButton: string;
  sharesInput: string;
  sellButton: string;
  orderSuccess: string;
  orderId: string;
  orderStatus: string;
  cancelButton: string;
  cancelSuccess: string;
}

export interface TiantianBrokerUrls {
  login: string;
  home: string;
  buy: string;
  sell: string;
  order: string;
}

export interface TiantianBrokerConfig {
  urls: TiantianBrokerUrls;
  selectors: TiantianBrokerSelectors;
  artifactDir: string;
  manualInterventionKeywords: string[];
}

const DEFAULT_MANUAL_INTERVENTION_KEYWORDS = [
  '验证码',
  '滑块',
  '安全验证',
  '身份验证',
  '人工',
  '接管',
  '风险提示',
  '登录已过期',
];

export function buildTiantianBrokerConfig(env: NodeJS.ProcessEnv): TiantianBrokerConfig {
  return {
    urls: {
      login: env.TIANTIAN_LOGIN_URL || 'https://trade.1234567.com.cn/login',
      home: env.TIANTIAN_HOME_URL || 'https://trade.1234567.com.cn/',
      buy: env.TIANTIAN_BUY_URL_TEMPLATE || 'https://trade.1234567.com.cn/buy/{fundCode}',
      sell: env.TIANTIAN_SELL_URL_TEMPLATE || 'https://trade.1234567.com.cn/sell/{fundCode}',
      order: env.TIANTIAN_ORDER_URL_TEMPLATE || 'https://trade.1234567.com.cn/order/{orderId}',
    },
    selectors: {
      usernameInput: env.TIANTIAN_SELECTOR_USERNAME || '#username',
      passwordInput: env.TIANTIAN_SELECTOR_PASSWORD || '#password',
      loginButton: env.TIANTIAN_SELECTOR_LOGIN_BUTTON || '#loginBtn',
      amountInput: env.TIANTIAN_SELECTOR_AMOUNT || '#amount',
      buyButton: env.TIANTIAN_SELECTOR_BUY_BUTTON || '#buyBtn',
      sharesInput: env.TIANTIAN_SELECTOR_SHARES || '#shares',
      sellButton: env.TIANTIAN_SELECTOR_SELL_BUTTON || '#sellBtn',
      orderSuccess: env.TIANTIAN_SELECTOR_ORDER_SUCCESS || '.order-success',
      orderId: env.TIANTIAN_SELECTOR_ORDER_ID || '.order-id',
      orderStatus: env.TIANTIAN_SELECTOR_ORDER_STATUS || '.order-status',
      cancelButton: env.TIANTIAN_SELECTOR_CANCEL_BUTTON || '#cancelBtn',
      cancelSuccess: env.TIANTIAN_SELECTOR_CANCEL_SUCCESS || '.cancel-success',
    },
    artifactDir: env.BROKER_ARTIFACT_DIR || 'storage/broker-artifacts',
    manualInterventionKeywords: parseKeywords(
      env.TIANTIAN_MANUAL_INTERVENTION_KEYWORDS,
      DEFAULT_MANUAL_INTERVENTION_KEYWORDS,
    ),
  };
}

export function formatBrokerUrl(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (url, [key, value]) => url.replaceAll(`{${key}}`, encodeURIComponent(value)),
    template,
  );
}

function parseKeywords(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}
