// TypeScript types for OTLP Logs and Pipelines format

export interface OTLPLogsRequest {
  resourceLogs: ResourceLogs[];
}

export interface ResourceLogs {
  resource?: Resource;
  scopeLogs: ScopeLogs[];
  schemaUrl?: string;
}

export interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords: LogRecord[];
  schemaUrl?: string;
}

export interface LogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
  flags?: number;
  traceId?: string;
  spanId?: string;
}

export interface Resource {
  attributes: KeyValue[];
  droppedAttributesCount?: number;
}

export interface InstrumentationScope {
  name: string;
  version?: string;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface AnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string;
  doubleValue?: number;
  arrayValue?: ArrayValue;
  kvlistValue?: KeyValueList;
  bytesValue?: string;
}

export interface ArrayValue {
  values: AnyValue[];
}

export interface KeyValueList {
  values: KeyValue[];
}

// Pipelines Stream format
export interface PipelineLogRecord {
  timestamp: string;
  timestamp_ns: number;
  observed_timestamp?: string;
  observed_timestamp_ns?: number;
  severity_number: number;
  severity_text: string;
  body: string;
  trace_id?: string;
  span_id?: string;
  flags?: number;
  attributes: Record<string, any>;
  resource_attributes: Record<string, any>;
  scope_name?: string;
  scope_version?: string;
  scope_attributes?: Record<string, any>;
  dropped_attributes_count?: number;
}

export interface Env {
  LOGS_PIPELINE: Pipeline;
}

export interface Pipeline {
  send(records: any[]): Promise<void>;
}
