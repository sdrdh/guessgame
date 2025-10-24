import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Singleton Logger instance
export const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'guess-game-service',
  logLevel: (process.env.POWERTOOLS_LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') || 'INFO',
});

// Singleton Tracer instance
export const tracer = new Tracer({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'guess-game-service',
  captureHTTPsRequests: true,
});

/**
 * Wraps a Lambda handler with Powertools middleware
 * - Injects Lambda context into logs
 * - Captures Lambda handler execution in X-Ray traces
 * - Captures response and errors in traces
 */
export const wrapHandler = <TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>
): middy.MiddyfiedHandler<TEvent, TResult> => {
  return middy(handler)
    .use(injectLambdaContext(logger, { clearState: true }))
    .use(captureLambdaHandler(tracer, { captureResponse: true }));
};
