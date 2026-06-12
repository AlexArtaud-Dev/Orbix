import { Injectable } from '@nestjs/common';
import { VaultService } from '../../../modules/vault/vault.service';
import { ModuleSettingsService } from '../../../modules/module-settings/module-settings.service';
import { fetchWithConfig } from '../../../modules/input/input-http.util';
import type {
  IInputProvider,
  InputFetchContext,
} from '../input-provider.interface';
import type { IModuleSettingsProvider } from '../../module-settings.interface';
import type { FileToArchive, ProviderMeta } from '../../providers.types';
import type { ModuleSettingsDefinition } from '../../module-settings.types';
import type { InputRow } from '../../../modules/input/input.types';
import type {
  HttpRestConfig,
  HttpBodyConfig,
  InputRequestParam,
} from '../../../modules/input/input.types';
import {
  InputFetchHttpException,
  InputFetchSizeExceededException,
  InputFetchInvalidResponseException,
  VaultAuthUnsupportedTypeException,
  VaultOAuth2TokenFailedException,
  VaultOAuth2MissingTokenException,
} from '../../../common/exceptions';

@Injectable()
export class HttpRestInputProvider
  implements IInputProvider, IModuleSettingsProvider
{
  readonly type = 'http-rest';
  readonly meta: ProviderMeta = {
    type: 'http-rest',
    label: 'HTTP REST',
    icon: 'globe',
    description:
      'Fetch data from any HTTP endpoint with configurable auth, headers, and body.',
  };

  readonly moduleSettingsDefinition: ModuleSettingsDefinition = {
    module: 'http-rest',
    labelKey: 'input.type.httpRest',
    descriptionKey: 'input.typeDesc.httpRest',
    fields: [
      {
        key: 'defaultTimeoutMs',
        type: 'number',
        defaultValue: 30000,
        labelKey: 'moduleSettings.httpRest.defaultTimeoutMs',
        descriptionKey: 'moduleSettings.httpRest.defaultTimeoutMsDesc',
        min: 1000,
        max: 300000,
      },
      {
        key: 'maxRetries',
        type: 'number',
        defaultValue: 0,
        labelKey: 'moduleSettings.httpRest.maxRetries',
        descriptionKey: 'moduleSettings.httpRest.maxRetriesDesc',
        min: 0,
        max: 5,
      },
    ],
  };

  constructor(
    private readonly vault: VaultService,
    private readonly moduleSettings: ModuleSettingsService,
  ) {}

  async fetch(
    input: InputRow,
    context: InputFetchContext,
  ): Promise<FileToArchive[]> {
    const { values: moduleValues } =
      await this.moduleSettings.getOne('http-rest');
    const timeoutMs =
      (moduleValues.defaultTimeoutMs as number | undefined) ?? 30_000;
    const maxRetries = (moduleValues.maxRetries as number | undefined) ?? 0;

    const config = input.config as unknown as HttpRestConfig;
    const headers: Record<string, string> = {};
    const maxBytes = context.maxSizeMb * 1024 * 1024;
    const method = config.method ?? 'GET';

    if (input.vaultId) {
      await this.applyVaultAuth(headers, input.vaultId);
    }

    const params = input.requestParams ?? [];
    const baseUrlObj = new URL(config.baseUrl);
    for (const param of params) {
      const value = await this.resolveInputParamValue(param);
      if (param.in === 'header') headers[param.key] = value;
      else if (param.in === 'query')
        baseUrlObj.searchParams.set(param.key, value);
    }

    for (const h of config.headers ?? []) {
      const value =
        h.valueType === 'vault_var' && h.vaultVarRef
          ? await this.resolveVaultVarRef(h.vaultVarRef)
          : (h.value ?? '');
      if (h.key) headers[h.key] = value;
    }

    const bodyResult = await this.buildInputBody(config.body);
    if (bodyResult.headers) Object.assign(headers, bodyResult.headers);
    const bodyInit: {
      method: string;
      headers: Record<string, string>;
      body?: BodyInit;
    } = {
      method,
      headers,
      ...(bodyResult.body !== undefined ? { body: bodyResult.body } : {}),
    };

    const skipTls = config.insecureSkipVerify ?? false;
    const results: FileToArchive[] = [];

    if (config.listEndpoint) {
      const listUrl = new URL(
        config.listEndpoint.startsWith('http')
          ? config.listEndpoint
          : config.baseUrl.replace(/\/$/, '') +
              (config.listEndpoint.startsWith('/') ? '' : '/') +
              config.listEndpoint,
      );
      baseUrlObj.searchParams.forEach((v, k) => listUrl.searchParams.set(k, v));

      const listRes = await this.withRetry(
        () =>
          fetchWithConfig(
            listUrl,
            bodyInit.method,
            bodyInit.headers,
            bodyInit.body,
            skipTls,
            timeoutMs,
          ),
        maxRetries,
      );
      if (!listRes.ok) {
        throw new InputFetchHttpException(
          listUrl.toString(),
          listRes.status,
          'Input list endpoint',
        );
      }

      const items = (await listRes.json()) as unknown[];
      if (!Array.isArray(items)) {
        throw new InputFetchInvalidResponseException(
          'Input list endpoint did not return a JSON array',
          { url: listUrl.toString() },
        );
      }

      const idField = config.responseMapping?.id ?? 'id';
      const nameField = config.responseMapping?.name ?? 'name';

      for (const item of items) {
        const rec = item as Record<string, unknown>;
        const rawId = rec[idField];
        const rawName = rec[nameField];
        const itemId =
          typeof rawId === 'string'
            ? rawId
            : typeof rawId === 'number'
              ? String(rawId)
              : '';
        const itemName =
          typeof rawName === 'string'
            ? rawName
            : typeof rawName === 'number'
              ? String(rawName)
              : itemId || 'file';
        if (!itemId) continue;
        if (!config.downloadEndpoint) continue;

        const downloadPath = config.downloadEndpoint.replace(
          '{id}',
          encodeURIComponent(itemId),
        );
        const downloadUrl =
          config.baseUrl.replace(/\/$/, '') +
          (downloadPath.startsWith('/') ? '' : '/') +
          downloadPath;

        const dlRes = await this.withRetry(
          () =>
            fetchWithConfig(
              downloadUrl,
              'GET',
              headers,
              undefined,
              skipTls,
              timeoutMs,
            ),
          maxRetries,
        );
        if (!dlRes.ok) {
          throw new InputFetchHttpException(
            downloadUrl,
            dlRes.status,
            `Input download for '${itemName}'`,
          );
        }

        const contentLength = dlRes.headers.get('content-length');
        if (contentLength) {
          const bytes = parseInt(contentLength, 10);
          if (!isNaN(bytes) && bytes > maxBytes) {
            throw new InputFetchSizeExceededException(
              itemName,
              Math.round(bytes / 1024 / 1024),
              context.maxSizeMb,
            );
          }
        }

        const buf = Buffer.from(await dlRes.arrayBuffer());
        if (buf.byteLength > maxBytes) {
          throw new InputFetchSizeExceededException(
            itemName,
            Math.round(buf.byteLength / 1024 / 1024),
            context.maxSizeMb,
          );
        }

        const safeName = itemName.replace(/[/\\]/g, '_');
        results.push({ buffer: buf, arc: safeName });
      }
    } else {
      const response = await this.withRetry(
        () =>
          fetchWithConfig(
            baseUrlObj,
            bodyInit.method,
            bodyInit.headers,
            bodyInit.body,
            skipTls,
            timeoutMs,
          ),
        maxRetries,
      );
      if (!response.ok) {
        throw new InputFetchHttpException(config.baseUrl, response.status);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        if (!isNaN(bytes) && bytes > maxBytes) {
          throw new InputFetchSizeExceededException(
            'source',
            Math.round(bytes / 1024 / 1024),
            context.maxSizeMb,
          );
        }
      }

      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.byteLength > maxBytes) {
        throw new InputFetchSizeExceededException(
          'source',
          Math.round(buf.byteLength / 1024 / 1024),
          context.maxSizeMb,
        );
      }

      const cdFilename = this.parseContentDispositionFilename(
        response.headers.get('content-disposition'),
      );
      const urlBasename =
        config.baseUrl.split('/').pop()?.split('?')[0] || 'download';
      const filename = cdFilename || urlBasename;
      results.push({ buffer: buf, arc: filename });
    }

    return results;
  }

  // ─── Retry helper ────────────────────────────────────────────────────────────

  private async withRetry(
    fn: () => Promise<Response>,
    maxRetries: number,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) throw err;
      }
    }
    // unreachable
    return fn();
  }

  // ─── Vault helpers ───────────────────────────────────────────────────────────

  private async applyVaultAuth(
    headers: Record<string, string>,
    vaultId: string,
  ): Promise<void> {
    const payload = await this.vault.getHttpPayload(vaultId);
    switch (payload.subtype) {
      case 'token':
        headers['Authorization'] = `Bearer ${payload.token}`;
        break;
      case 'username_password':
        headers['Authorization'] =
          `Basic ${Buffer.from(`${payload.username}:${payload.password}`).toString('base64')}`;
        break;
      case 'key_secret':
        headers[payload.key] = payload.secret;
        break;
      case 'oauth2_client_credentials': {
        const token = await this.fetchOAuth2ClientToken(
          payload.tokenUrl,
          payload.clientId,
          payload.clientSecret,
          payload.scope,
        );
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'oauth2_password_grant': {
        const token = await this.fetchOAuth2PasswordToken(
          payload.tokenUrl,
          payload.clientId,
          payload.username,
          payload.password,
        );
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'cookie':
        headers['Cookie'] = payload.value;
        break;
      case 'custom_kv':
        for (const { key, value } of payload.entries) headers[key] = value;
        break;
      default:
        throw new VaultAuthUnsupportedTypeException(payload.subtype);
    }
  }

  private async resolveInputParamValue(
    param: InputRequestParam,
  ): Promise<string> {
    if (param.valueType === 'literal') return param.value ?? '';
    if (!param.vaultId) return '';
    const payload = await this.vault.getHttpPayload(param.vaultId);
    const field = param.vaultField ?? '';
    const raw = (payload as unknown as Record<string, unknown>)[field];
    return typeof raw === 'string' ? raw : '';
  }

  private async resolveVaultVarRef(ref: string): Promise<string> {
    const dotIdx = ref.indexOf('.');
    if (dotIdx < 0) return '';
    const slug = ref.slice(0, dotIdx);
    const fieldKey = ref.slice(dotIdx + 1);
    try {
      const payload = await this.vault.getVariableSetPayloadBySlug(slug);
      return payload[fieldKey] ?? '';
    } catch {
      return '';
    }
  }

  private async resolveVaultVarTemplate(text: string): Promise<string> {
    const pattern = /\{\{vault\.var\.([^.}]+)\.([^}]+)\}\}/g;
    const tokens = [...text.matchAll(pattern)];
    if (tokens.length === 0) return text;

    const slugs = [...new Set(tokens.map((m) => m[1]))];
    const payloads: Record<string, Record<string, string>> = {};
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          payloads[slug] = await this.vault.getVariableSetPayloadBySlug(slug);
        } catch {
          payloads[slug] = {};
        }
      }),
    );

    return text.replace(pattern, (_, slug: string, fieldKey: string) => {
      return payloads[slug]?.[fieldKey] ?? '';
    });
  }

  // ─── Body builder ────────────────────────────────────────────────────────────

  private async buildInputBody(
    bodyConfig: HttpBodyConfig | undefined,
  ): Promise<{ body?: BodyInit; headers?: Record<string, string> }> {
    if (!bodyConfig || bodyConfig.type === 'none') return {};

    const extraHeaders: Record<string, string> = {};

    switch (bodyConfig.type) {
      case 'json': {
        const raw = bodyConfig.json ?? '{}';
        const resolved = await this.resolveVaultVarTemplate(raw);
        extraHeaders['Content-Type'] = 'application/json';
        return { body: resolved, headers: extraHeaders };
      }
      case 'raw': {
        const resolved = await this.resolveVaultVarTemplate(
          bodyConfig.raw ?? '',
        );
        return { body: resolved, headers: extraHeaders };
      }
      case 'graphql': {
        const query = bodyConfig.raw ?? '';
        const variables = bodyConfig.graphqlVariables
          ? await this.resolveVaultVarTemplate(bodyConfig.graphqlVariables)
          : undefined;
        extraHeaders['Content-Type'] = 'application/json';
        const payload: Record<string, unknown> = { query };
        if (variables) {
          try {
            payload['variables'] = JSON.parse(variables) as unknown;
          } catch {
            payload['variables'] = variables;
          }
        }
        return { body: JSON.stringify(payload), headers: extraHeaders };
      }
      case 'form-data': {
        const fd = new FormData();
        for (const field of bodyConfig.formData ?? []) {
          const value =
            field.valueType === 'vault_var' && field.vaultVarRef
              ? await this.resolveVaultVarRef(field.vaultVarRef)
              : await this.resolveVaultVarTemplate(field.value ?? '');
          fd.append(field.key, value);
        }
        return { body: fd, headers: extraHeaders };
      }
      case 'x-www-form-urlencoded': {
        const params = new URLSearchParams();
        for (const field of bodyConfig.urlEncoded ?? []) {
          const value =
            field.valueType === 'vault_var' && field.vaultVarRef
              ? await this.resolveVaultVarRef(field.vaultVarRef)
              : await this.resolveVaultVarTemplate(field.value ?? '');
          params.append(field.key, value);
        }
        extraHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        return { body: params.toString(), headers: extraHeaders };
      }
      default:
        return {};
    }
  }

  // ─── OAuth2 helpers ──────────────────────────────────────────────────────────

  private async fetchOAuth2ClientToken(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    scope?: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope ? { scope } : {}),
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok)
      throw new VaultOAuth2TokenFailedException(res.status, tokenUrl);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new VaultOAuth2MissingTokenException(tokenUrl);
    return json.access_token;
  }

  private async fetchOAuth2PasswordToken(
    tokenUrl: string,
    clientId: string,
    username: string,
    password: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username,
      password,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok)
      throw new VaultOAuth2TokenFailedException(res.status, tokenUrl);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new VaultOAuth2MissingTokenException(tokenUrl);
    return json.access_token;
  }

  // ─── Filename parsing ────────────────────────────────────────────────────────

  private parseContentDispositionFilename(
    header: string | null,
  ): string | null {
    if (!header) return null;
    const match = header.match(
      /filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i,
    );
    if (!match) return null;
    try {
      return decodeURIComponent(match[1].trim().replace(/["']/g, ''));
    } catch {
      return match[1].trim().replace(/["']/g, '');
    }
  }
}
