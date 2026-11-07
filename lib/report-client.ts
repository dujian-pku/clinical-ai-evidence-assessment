const endpoint = import.meta.env.VITE_REPORT_API_URL?.trim();

export function reportEndpoint() {
  if (!endpoint) throw new Error('报告服务尚未接入，请先生成简版报告。');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('报告服务地址无效。');
  }
  return url.href;
}
