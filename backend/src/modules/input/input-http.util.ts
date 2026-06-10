/**
 * Shared HTTP fetch utility used by both InputService (test) and BackupRunner.
 * Handles TLS bypass for servers with self-signed certificates.
 */
import * as http from 'node:http';
import * as https from 'node:https';

/**
 * Wraps native fetch with optional TLS verification bypass.
 * For string/URLSearchParams/Buffer bodies with HTTPS + insecureSkipVerify,
 * uses a custom https.Agent. FormData falls through to native fetch.
 */
export async function fetchWithConfig(
  url: URL | string,
  method: string,
  headers: Record<string, string>,
  body?: BodyInit,
  insecureSkipVerify = false,
  timeoutMs = 30_000,
): Promise<Response> {
  const urlObj = typeof url === 'string' ? new URL(url) : url;

  // If no bypass needed, use native fetch
  if (!insecureSkipVerify || urlObj.protocol !== 'https:') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);
    try {
      return await fetch(urlObj.toString(), {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // TLS bypass path — convert body to string when possible
  let bodyStr: string | undefined;
  if (body === undefined) {
    bodyStr = undefined;
  } else if (typeof body === 'string') {
    bodyStr = body;
  } else if (body instanceof URLSearchParams) {
    bodyStr = body.toString();
  } else if (Buffer.isBuffer(body)) {
    bodyStr = body.toString('binary');
  } else {
    // FormData or other complex types — can't easily serialize; fall back to native fetch
    return fetch(urlObj.toString(), {
      method,
      headers,
      body,
    });
  }

  return fetchInsecure(urlObj, method, headers, bodyStr, timeoutMs);
}

function fetchInsecure(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 30_000,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqHeaders = { ...headers };
    if (
      body !== undefined &&
      !reqHeaders['Content-Length'] &&
      !reqHeaders['content-length']
    ) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body).toString();
    }

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
      timeout: timeoutMs,
      ...(isHttps
        ? { agent: new https.Agent({ rejectUnauthorized: false }) }
        : {}),
    };

    const req = lib.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const resBody = Buffer.concat(chunks);
        const status = res.statusCode ?? 0;
        const statusText = res.statusMessage ?? '';
        const outHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined)
            outHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
        }
        resolve(
          new Response(resBody, { status, statusText, headers: outHeaders }),
        );
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
