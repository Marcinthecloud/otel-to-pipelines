# OTLP to Cloudflare Pipelines

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)

A slightly vibe-coded example Cloudflare Worker that receives OpenTelemetry Protocol (OTLP) logs from [the new export feature](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/) in Workers Observability and writes them to Cloudflare Pipelines for easy processing, filtering, and writing to R2 or R2 Data Catalog (Apache Iceberg tables).


## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- [Node.js](https://nodejs.org/) 18+ installed
- Cloudflare Pipelines enabled on your account

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/otlp-to-pipelines.git
cd otlp-to-pipelines
npm install
```

### 2. Create a Pipeline 

Create a new Pipelines stream to store your logs:

#### Pipeline Streams
```bash
npx wrangler pipelines streams create otlp_stream --schema-file pipelines-schema.json
```

Copy the **stream ID** or get it using:

```bash
npx wrangler pipelines streams list
```

#### Pipelines Sink (R2 Data Catalog example)
```bash
npx wrangler pipelines sinks create otlp_sink \
  --type r2-data-catalog \
  --bucket my-bucket \
  --namespace otlp \
  --table worker_logs \
  --catalog-token YOUR_CATALOG_TOKEN \
  --compression zstd \
  --roll-interval 60  # Write files every 60 seconds
  ```
  
For the catalog-token, see [HERE](https://developers.cloudflare.com/r2/data-catalog/manage-catalogs/#create-api-token-in-the-dashboard)

For info about setting up R2 Data Catalog, see [HERE](https://developers.cloudflare.com/r2/data-catalog/get-started/)

#### Pipelines SQL
Process data from the stream and write it to the configured sink
```bash
npx wrangler pipelines create otlp_pipeline \
  --sql "INSERT INTO otlp_sink
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
FROM otlp_stream;"
```

You can do a lot with Pipelines SQL - see the reference [HERE](https://developers.cloudflare.com/pipelines/sql-reference/select-statements/)

### 3. Configure the Worker

Copy the example config and add your pipeline ID:

```bash
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml` and replace `YOUR_PIPELINE_STREAM_ID_HERE` with the stream ID.

### 4. Deploy

```bash
npx wrangler deploy
```

Your worker will be deployed and you'll get a URL like: `https://otlp-to-pipelines.your-subdomain.workers.dev`

### 5. Configure OTLP Source

In your Cloudflare Worker that you want to send logs from:

1. Go to **Workers & Pages** → Select your worker
2. Navigate to **Settings** → **Observability**
3. Click **Add destination** under OTLP destinations
4. Enter your worker URL (in this case, you don't need `/v1/logs`)

## Enable logging in your worker:

### Wrangler TOML:
```
[observability]
[observability.logs]
enabled = true
head_sampling_rate = 1
invocation_logs = true
destinations = [ "NAME_OF_DESTINATION_FROM_PRIOR_STEP" ]
persist = true
```

### Dash
1. Go to **Workers & Pages** → Select your worker
2. Navigate to **Settings** → **Observability**
3. Click **the edit icon** next to Workers Logs
4. Click **Enable** and choose the destination in the **Export logs to external destinations** drop down
4. Click **deploy** - Note that you'll need to update your Wrangler config otherwise your next deploy will override these settings. 

## Usage

You can use R2 SQL to filter through these logs:
```bash
npx wrangler r2 sql query "YOUR_WAREHOUSE" "SELECT severity_text, body FROM otlp.worker_logs limit 10;```
```
Or [ANY](https://developers.cloudflare.com/r2/data-catalog/config-examples/duckdb/) Iceberg compatible query engine

You can check the health of the receiver with

```bash
curl https://otlp-to-pipelines.your-subdomain.workers.dev
```

Response:
```json
{
  "status": "ok",
  "message": "OTLP receiver is ready",
  "version": "1.0.0",
  "endpoints": {
    "logs": "/v1/logs"
  }
}
```
You can also check what events are successfully being processed with:
`npx wrangler tail` 
which will look like this: 
```bash
❯ npx wrangler tail  

 ⛅️ wrangler 4.45.2 
─────────────────────────────────────────────
Successfully created tail, expires at 2025-10-31T00:18:39Z
Connected to otlp-to-pipelines, waiting for logs...
POST https://otlp-to-pipelines.[your_domain]].workers.dev/ - Ok @ 10/30/2025, 11:21:25 AM
```

## About the data

The Worker takes the OTLP logs and formats it to be compatible with Cloudflare Pipelines:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp |
| `timestamp_ns` | int64 | Unix timestamp in nanoseconds |
| `severity_number` | int32 | Numeric severity (0-24) |
| `severity_text` | string | Text severity (DEBUG, INFO, WARN, ERROR, FATAL) |
| `body` | string | Log message |
| `trace_id` | string | Distributed tracing trace ID (hex) |
| `span_id` | string | Distributed tracing span ID (hex) |
| `attributes` | json | Log-level attributes |
| `resource_attributes` | json | Resource attributes (service.name, etc.) |
| `scope_name` | string | Instrumentation scope |

See [pipelines-schema.json](pipelines-schema.json) for the full schema.

### Local Development

```bash
npx wrangler dev
```

The worker will be available at `http://localhost:8787`

### Testing

Test with the example request:

```bash
curl -X POST http://localhost:8787/v1/logs \
  -H "Content-Type: application/json" \
  -d @example-request.json
```

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pipelines Documentation](https://developers.cloudflare.com/pipelines/)
- [OpenTelemetry OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

