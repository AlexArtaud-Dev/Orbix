export interface HttpRestConfig {
  baseUrl: string;
  listEndpoint?: string; // if absent → single direct download from baseUrl
  downloadEndpoint?: string; // e.g. "/files/{id}" — used when listEndpoint is set
  responseMapping?: { id?: string; name?: string };
  filterConfig?: Record<string, unknown>;
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
