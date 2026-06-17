// lib/daraja/types.ts
// TypeScript types for Safaricom Daraja API v2 payloads

export interface DarajaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: "CustomerPayBillOnline";
  Amount: number;
  PartyA: string; // tenant phone
  PartyB: string; // shortcode
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string; // tenantId
  TransactionDesc: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage?: string;
}

export interface StkCallbackBody {
  stkCallback: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResultCode: number;
    ResultDesc: string;
    CallbackMetadata?: {
      Item: Array<{
        Name: string;
        Value: string | number;
      }>;
    };
  };
}

export interface C2BValidationRequest {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string;
  MSISDN: string;
  FirstName: string;
  MiddleName?: string;
  LastName?: string;
  OrgAccountBalance?: string;
}

export interface C2BConfirmationRequest extends C2BValidationRequest {}

export interface DarajaCallbackResponse {
  ResultCode: string;
  ResultDesc: string;
}