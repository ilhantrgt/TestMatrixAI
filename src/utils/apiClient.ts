/**
 * Robust API Client with automatic retry for transient gateway errors (502/503/504)
 * and guaranteed JSON parsing protection against HTML error fallbacks.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  defaultErrorMessage = 'Sunucu işlemi sırasında bir hata oluştu.',
  maxRetries = 3
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  options.headers = headers;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isJsonContentType = contentType.includes('application/json') || contentType.includes('text/json');
      const rawText = await response.text().catch(() => '');

      // Check if response is HTML fallback from proxy/webserver (e.g., during cold boot or restart)
      const isHtmlText =
        rawText.trim().startsWith('<') ||
        rawText.includes('<!doctype') ||
        rawText.includes('<html');

      if (!response.ok) {
        // Retry on 502 / 503 / 504 gateway or proxy errors
        if (
          (response.status === 502 || response.status === 503 || response.status === 504 || isHtmlText) &&
          attempt < maxRetries
        ) {
          attempt++;
          const delayMs = attempt * 1200;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        if (isJsonContentType) {
          try {
            const errJson = JSON.parse(rawText);
            const detailMsg = errJson.details ? `: ${errJson.details}` : '';
            throw new Error((errJson.error || defaultErrorMessage) + detailMsg);
          } catch {
            throw new Error(defaultErrorMessage);
          }
        } else {
          if (response.status === 502 || response.status === 503 || response.status === 504 || isHtmlText) {
            throw new Error('Sunucu şu anda başlatılıyor veya yanıt veremiyor. Lütfen birkaç saniye sonra tekrar deneyin.');
          }
          throw new Error(defaultErrorMessage);
        }
      }

      // Response status is 200 OK
      if (isHtmlText) {
        if (attempt < maxRetries) {
          attempt++;
          const delayMs = attempt * 1200;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new Error('Sunucu bağlantısı yeniden başlatılıyor. Lütfen 3-5 saniye sonra tekrar deneyiniz.');
      }

      // Try parsing JSON payload
      try {
        return JSON.parse(rawText) as T;
      } catch {
        throw new Error('Sunucudan beklenmeyen bir veri formatı alındı.');
      }
    } catch (err: any) {
      lastError = err;
      // Network failure / connection refused retry
      if (
        (err.message?.includes('fetch') ||
          err.message?.includes('NetworkError') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('Sunucuya bağlanılamadı') ||
          err.message?.includes('Sunucu bağlantısı yeniden başlatılıyor')) &&
        attempt < maxRetries
      ) {
        attempt++;
        const delayMs = attempt * 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(defaultErrorMessage);
}

