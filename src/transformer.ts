// Transform OTLP logs to Pipelines format

import type {
  OTLPLogsRequest,
  LogRecord,
  AnyValue,
  KeyValue,
  PipelineLogRecord,
  ResourceLogs,
  ScopeLogs,
} from './types';

/**
 * Convert OTLP AnyValue to a simple JavaScript value
 */
export function anyValueToJS(value: AnyValue | undefined): any {
  if (!value) return null;

  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.intValue !== undefined) return value.intValue;
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.bytesValue !== undefined) return value.bytesValue;

  if (value.arrayValue) {
    return value.arrayValue.values.map(v => anyValueToJS(v));
  }

  if (value.kvlistValue) {
    return keyValueListToObject(value.kvlistValue.values);
  }

  return null;
}

/**
 * Convert KeyValue array to plain object
 */
export function keyValueListToObject(kvList: KeyValue[] | undefined): Record<string, any> {
  if (!kvList) return {};

  const result: Record<string, any> = {};
  for (const kv of kvList) {
    result[kv.key] = anyValueToJS(kv.value);
  }
  return result;
}

/**
 * Convert nanosecond timestamp to ISO string
 */
export function nanoToISO(nanoString: string | undefined): string | undefined {
  if (!nanoString) return undefined;

  // Convert nanoseconds to milliseconds
  const ms = Math.floor(Number(nanoString) / 1_000_000);
  return new Date(ms).toISOString();
}

/**
 * Convert trace/span ID bytes to hex string
 */
export function bytesToHex(bytes: string | undefined): string | undefined {
  if (!bytes) return undefined;

  // If already a hex string, return as-is
  if (typeof bytes === 'string' && /^[0-9a-fA-F]+$/.test(bytes)) {
    return bytes;
  }

  // Convert base64 to hex
  try {
    const buffer = Uint8Array.from(atob(bytes), c => c.charCodeAt(0));
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return bytes;
  }
}

/**
 * Get severity text from severity number
 */
export function getSeverityText(severityNumber: number | undefined, severityText: string | undefined): string {
  if (severityText) return severityText;

  const severityMap: Record<number, string> = {
    0: 'UNSPECIFIED',
    1: 'TRACE', 2: 'TRACE2', 3: 'TRACE3', 4: 'TRACE4',
    5: 'DEBUG', 6: 'DEBUG2', 7: 'DEBUG3', 8: 'DEBUG4',
    9: 'INFO', 10: 'INFO2', 11: 'INFO3', 12: 'INFO4',
    13: 'WARN', 14: 'WARN2', 15: 'WARN3', 16: 'WARN4',
    17: 'ERROR', 18: 'ERROR2', 19: 'ERROR3', 20: 'ERROR4',
    21: 'FATAL', 22: 'FATAL2', 23: 'FATAL3', 24: 'FATAL4',
  };

  return severityMap[severityNumber || 0] || 'UNSPECIFIED';
}

/**
 * Transform a single OTLP LogRecord to Pipelines format
 */
export function transformLogRecord(
  logRecord: LogRecord,
  resourceLogs: ResourceLogs,
  scopeLogs: ScopeLogs
): PipelineLogRecord {
  const resourceAttributes = keyValueListToObject(resourceLogs.resource?.attributes);
  const logAttributes = keyValueListToObject(logRecord.attributes);
  const scopeAttributes = keyValueListToObject(scopeLogs.scope?.attributes);

  // Extract body as string
  let body = '';
  if (logRecord.body) {
    const bodyValue = anyValueToJS(logRecord.body);
    body = typeof bodyValue === 'string' ? bodyValue : JSON.stringify(bodyValue);
  }

  return {
    timestamp: nanoToISO(logRecord.timeUnixNano) || new Date().toISOString(),
    timestamp_ns: Number(logRecord.timeUnixNano || 0),
    observed_timestamp: nanoToISO(logRecord.observedTimeUnixNano),
    observed_timestamp_ns: Number(logRecord.observedTimeUnixNano || 0),
    severity_number: logRecord.severityNumber || 0,
    severity_text: getSeverityText(logRecord.severityNumber, logRecord.severityText),
    body,
    trace_id: bytesToHex(logRecord.traceId),
    span_id: bytesToHex(logRecord.spanId),
    flags: logRecord.flags,
    attributes: logAttributes,
    resource_attributes: resourceAttributes,
    scope_name: scopeLogs.scope?.name,
    scope_version: scopeLogs.scope?.version,
    scope_attributes: scopeAttributes,
    dropped_attributes_count: logRecord.droppedAttributesCount,
  };
}

/**
 * Transform OTLP logs request to array of Pipelines log records
 */
export function transformOTLPLogs(request: OTLPLogsRequest): PipelineLogRecord[] {
  const records: PipelineLogRecord[] = [];

  for (const resourceLogs of request.resourceLogs || []) {
    for (const scopeLogs of resourceLogs.scopeLogs || []) {
      for (const logRecord of scopeLogs.logRecords || []) {
        records.push(transformLogRecord(logRecord, resourceLogs, scopeLogs));
      }
    }
  }

  return records;
}
