export interface BrokerFailureEvidence {
  screenshotPath?: string;
  domSummary?: string;
  capturedAt: string;
  operation: string;
}

export interface BrokerOperationErrorOptions {
  manualInterventionRequired?: boolean;
  evidence?: BrokerFailureEvidence;
  originalMessage?: string;
}

export class BrokerOperationError extends Error {
  readonly manualInterventionRequired: boolean;
  readonly evidence?: BrokerFailureEvidence;
  readonly originalMessage?: string;

  constructor(message: string, options: BrokerOperationErrorOptions = {}) {
    super(message);
    this.name = 'BrokerOperationError';
    this.manualInterventionRequired = options.manualInterventionRequired ?? false;
    this.evidence = options.evidence;
    this.originalMessage = options.originalMessage;
  }
}

export function isBrokerOperationError(error: unknown): error is BrokerOperationError {
  return error instanceof BrokerOperationError || hasBrokerEvidence(error);
}

export function hasBrokerEvidence(error: unknown): error is {
  manualInterventionRequired?: boolean;
  evidence?: BrokerFailureEvidence;
} {
  return typeof error === 'object' && error !== null && 'evidence' in error;
}
