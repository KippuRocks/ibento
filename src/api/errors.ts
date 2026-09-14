import type { AppRouter } from "@kippu/api";
import { TRPCClientError } from "@trpc/client";

/** How a failed call failed, as far as the client can tell. */
export interface Failure {
  /** The `SPEC.md` §10 code, carried verbatim in `error.data.errorCode`, when there is one. */
  readonly errorCode: string | null;
  /** tRPC's transport class, such as `NOT_FOUND`, when the server answered. */
  readonly transport: string | null;
}

export function failureOf(error: unknown): Failure {
  if (error instanceof TRPCClientError) {
    const typed = error as TRPCClientError<AppRouter>;
    return { errorCode: typed.data?.errorCode ?? null, transport: typed.data?.code ?? null };
  }
  return { errorCode: null, transport: null };
}

/**
 * What a failed call tells the organiser: the §10 code verbatim when the error
 * carries one (`REQ-Q-3`); the API's own refusal when it names no code, such as
 * a document that does not conform to its schema; otherwise that Kippu could
 * not be reached.
 */
export function describeFailure(error: unknown): string {
  const { errorCode, transport } = failureOf(error);
  if (errorCode !== null) {
    return errorCode;
  }
  if (
    error instanceof TRPCClientError &&
    transport !== null &&
    transport !== "INTERNAL_SERVER_ERROR"
  ) {
    return error.message;
  }
  return "Kippu could not be reached. Try again.";
}
