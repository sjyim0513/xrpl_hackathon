export interface AccountRootFinalFields {
  Account: string; // 계정 주소
  Balance: string; // XRP 잔액 (drops 단위, 문자열)
  Flags: number; // 계정 플래그
  OwnerCount: number; // 계정이 소유한 객체 수 (예: 신뢰선, 주문 등)
  Sequence: number; // 다음에 사용할 거래 시퀀스 번호
  // 기타 계정 관련 필드가 있을 수 있음
}

// RippleState의 최종 상태 필드 (신뢰선 정보, 주로 IOU 관련)
export interface RippleStateFinalFields {
  Balance: {
    // 두 계정 간의 잔액 (IOU의 경우 객체 형태)
    currency: string;
    issuer: string;
    value: string;
  };
  Flags: number; // 신뢰선 플래그 (예: rippling 허용 여부 등)
  HighLimit: {
    // 한쪽 계정의 신뢰 한도
    currency: string;
    issuer: string;
    value: string;
  };
  LowLimit: {
    // 반대쪽 계정의 신뢰 한도
    currency: string;
    issuer: string;
    value: string;
  };
  HighNode: string; // 고급 내부 노드 식별자
  LowNode: string; // 저급 내부 노드 식별자
  // 추가 필드가 있을 수 있음
}

// AccountRoot의 이전 상태에서 변화가 있었던 필드들
export interface AccountRootPreviousFields {
  Balance?: string;
  Sequence?: number;
  // OwnerCount나 Flags 등 필요에 따라 추가 가능
}

// RippleState의 이전 상태 (변경 전 잔액 등)
export interface RippleStatePreviousFields {
  Balance?: {
    currency: string;
    issuer: string;
    value: string;
  };
  // 필요한 경우 HighLimit, LowLimit 등의 변화도 추가할 수 있음
}

// ModifiedNode 내부에서 최종 필드와 이전 필드를 모두 포함하는 타입
export type FinalFields = AccountRootFinalFields | RippleStateFinalFields;
export type PreviousFields =
  | AccountRootPreviousFields
  | RippleStatePreviousFields;

// ModifiedNode 인터페이스 (meta의 AffectedNodes에서 사용됨)
export interface ModifiedNode {
  FinalFields: FinalFields; // 거래 적용 후 최종 상태
  PreviousFields?: PreviousFields; // 거래 적용 전 상태 (변경된 필드만 포함)
  LedgerEntryType: string; // 예: "AccountRoot", "RippleState" 등
  LedgerIndex: string; // 해당 ledger 객체의 인덱스 (해시 문자열)
  PreviousTxnID?: string; // 이전 거래 ID
  PreviousTxnLgrSeq?: number; // 이전 거래가 포함된 원장의 시퀀스 번호
}

export interface XRPLTransaction {
  tx_json: {
    Account: string;
    Destination: string;
    Fee: string;
    TransactionType: string;
    Amount?: string | { currency: string; issuer: string; value: string };
    DeliverMax?: string | { currency: string; issuer: string; value: string };
    SendMax?: string | { currency: string; issuer: string; value: string };
    date: number;
  };
  meta: {
    delivered_amount?:
      | string
      | { currency: string; issuer: string; value: string };
    AffectedNodes?: ModifiedNode[];
  };
  ledger_index: number;
  hash: string;
}

export interface GroupedTransactions {
  A_XRP: XRPLTransaction[];
  A_Other: Record<string, XRPLTransaction[]>;
}

export interface PoolState {
  beforeprice: number;
  //poolData: Array<[string, any, string, any, any]>;
  categoryDate: string[];
  values: number[][];
  type: string[];
  tx: any[];
  info: (payment | send | route | trustLine | offer)[];
}

export interface payment {
  keyType: string;
  account: string;
  fee: number;
  sendAmount: number;
  deliveredAmount: number;
}

export interface send {
  keyType: string;
  account: string;
  fee: number;
  deliveredAmount: string;
  Destination: string;
}

export interface route {
  keyType: string;
  account: string;
  fee: number;
}

export interface trustLine {
  keyType: string;
  account: string;
  fee: number;
  amount: string;
}

export interface offer {
  keyType: string;
  account: string;
  fee: number;
  takerpay: string | { currency: string; issuer: string; value: string };
  takerget: string | { currency: string; issuer: string; value: string };
}

export interface txInfo {}
