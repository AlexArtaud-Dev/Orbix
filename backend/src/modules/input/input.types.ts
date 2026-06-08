export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HttpBodyType =
  | 'none'
  | 'raw'
  | 'json'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'graphql';

export interface HttpHeader {
  key: string;
  /** "literal" = raw string value; "vault_var" = {{vault.var.<id>.<field>}} reference */
  valueType: 'literal' | 'vault_var';
  value?: string;
  /** "vaultId.fieldKey" — used only when valueType === "vault_var" */
  vaultVarRef?: string;
}

export interface FormField {
  key: string;
  valueType: 'literal' | 'vault_var';
  value?: string;
  vaultVarRef?: string;
}

export interface HttpBodyConfig {
  type: HttpBodyType;
  /** type: raw or graphql query */
  raw?: string;
  /** type: json — JSON string, may contain {{vault.var.*}} tokens */
  json?: string;
  /** type: form-data */
  formData?: FormField[];
  /** type: x-www-form-urlencoded */
  urlEncoded?: FormField[];
  /** type: graphql — JSON string of variables */
  graphqlVariables?: string;
}

export interface HttpRestConfig {
  baseUrl: string;
  /** HTTP method for the main request (default GET) */
  method?: HttpMethod;
  listEndpoint?: string; // if absent → single direct download from baseUrl
  downloadEndpoint?: string; // e.g. "/files/{id}" — used when listEndpoint is set
  responseMapping?: { id?: string; name?: string };
  filterConfig?: Record<string, unknown>;
  /** Custom headers to attach to every request */
  headers?: HttpHeader[];
  /** Request body config */
  body?: HttpBodyConfig;
}

export interface InputRequestParam {
  in: 'header' | 'query' | 'body';
  key: string;
  valueType: 'literal' | 'vault';
  value?: string;
  vaultId?: string;
  vaultField?: string;
}

export interface InputRow {
  id: string;
  name: string;
  type: string;
  vaultId: string | null;
  config: Record<string, unknown>;
  requestParams: InputRequestParam[];
  enabled: boolean;
  lastTestAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
