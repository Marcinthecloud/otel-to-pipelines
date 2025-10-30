/**
 * Cloudflare Worker that receives OTLP logs and writes them to Pipelines
 *
 * @author Marc Selwan & Claude Code
 * @license MIT
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env, OTLPLogsRequest } from './types';
import { transformOTLPLogs } from './transformer';

/**
 * OTLP Receiver Worker
 *
 * Receives OpenTelemetry Protocol (OTLP) logs via RPC or HTTP
 * and forwards them to Cloudflare Pipelines for storage and analysis.
 */
export default class OTLPReceiver extends WorkerEntrypoint<Env> {
  /**
   * RPC method for Cloudflare's native OTLP integration
   *
   * This is called when you configure an OTLP destination in the Cloudflare dashboard.
   * The data is already parsed and ready to be transformed.
   *
   * @param data - OTLP logs data (string or object)
   * @returns Success response with record count
   */
  async write(data: any): Promise<{ success: boolean; recordsWritten: number }> {
    try {
      // Handle different data formats
      let otlpRequest: OTLPLogsRequest;

      if (typeof data === 'string') {
        otlpRequest = JSON.parse(data);
      } else if (data && typeof data === 'object') {
        otlpRequest = data as OTLPLogsRequest;
      } else {
        throw new Error(`Unexpected data type: ${typeof data}`);
      }

      // Transform and send to Pipelines
      const pipelineRecords = transformOTLPLogs(otlpRequest);

      if (pipelineRecords.length > 0) {
        await this.env.LOGS_PIPELINE.send(pipelineRecords);
      }

      return { success: true, recordsWritten: pipelineRecords.length };
    } catch (error) {
      console.error('Error processing OTLP logs via RPC:', error);
      throw error;
    }
  }

  /**
   * HTTP fetch handler for standard OTLP/HTTP requests
   *
   * Handles both health checks (GET) and OTLP log ingestion (POST).
   * Supports gzip compression and JSON format.
   *
   * @param request - Incoming HTTP request
   * @returns HTTP response
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: 'OTLP receiver is ready',
          version: '1.0.0',
          endpoints: {
            logs: '/v1/logs',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Only POST allowed for log ingestion
    if (request.method !== 'POST') {
      return new Response('Method not allowed. Use POST to send logs or GET for health check.', {
        status: 405,
      });
    }

    // Accept both root path and /v1/logs path
    if (url.pathname !== '/' && url.pathname !== '/v1/logs') {
      return new Response('Not found. Use / or /v1/logs endpoint', { status: 404 });
    }

    try {
      // Parse request body (with gzip support)
      const otlpRequest = await this.parseRequestBody(request);

      // Transform and send to Pipelines
      const pipelineRecords = transformOTLPLogs(otlpRequest);

      if (pipelineRecords.length > 0) {
        await this.env.LOGS_PIPELINE.send(pipelineRecords);
      }

      // Return OTLP success response
      return new Response(
        JSON.stringify({
          partialSuccess: {
            rejectedLogRecords: 0,
            errorMessage: '',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error processing OTLP logs:', error);

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  }

  /**
   * Parse request body, handling gzip compression
   *
   * @param request - HTTP request
   * @returns Parsed OTLP logs request
   */
  private async parseRequestBody(request: Request): Promise<OTLPLogsRequest> {
    const contentEncoding = request.headers.get('content-encoding') || '';

    let buffer = await request.arrayBuffer();
    let bytes = new Uint8Array(buffer);

    // Handle gzip compression (Cloudflare's default)
    if (contentEncoding.includes('gzip') || (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b)) {
      const decompressedStream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
      buffer = await new Response(decompressedStream).arrayBuffer();
      bytes = new Uint8Array(buffer);
    }

    // Parse JSON
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as OTLPLogsRequest;
  }
}
