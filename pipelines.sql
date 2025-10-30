-- Transform OTLP logs from pipeline stream to sink with microsecond timestamps
-- Replace [sink_name] with your actual sink name
-- Replace [pipeline_stream_name] with your actual pipeline stream name

INSERT INTO [sink_name]
SELECT
  to_timestamp_micros(timestamp_ns / 1000) AS timestamp_micros,
  to_timestamp_micros(observed_timestamp_ns / 1000) AS observed_timestamp_micros,
  severity_number,
  severity_text,
  body,
  trace_id,
  span_id,
  flags,
  attributes,
  resource_attributes,
  scope_name,
  scope_version,
  scope_attributes,
  dropped_attributes_count
FROM [pipeline_stream_name];
