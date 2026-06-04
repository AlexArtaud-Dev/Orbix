export interface EmailPayload {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddr: string;
  fromName: string;
  secure: boolean;
}

export interface EmailVaultResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  fromAddr: string;
  fromName: string;
  secure: boolean;
  smtpStatus: string | null;
  smtpStatusMsg: string | null;
  smtpCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VaultRow = {
  id: string;
  name: string;
  type: string;
  encryptedPayload: string;
  smtpStatus: string | null;
  smtpStatusMsg: string | null;
  smtpCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
