interface ErrorReportContext {
  area: string;
  details?: Record<string, unknown>;
}

interface ClientErrorReport {
  reference: string;
}

const errorReferences = new WeakMap<object, string>();
const loggedErrors = new WeakSet<object>();
let errorSequence = 0;

function createErrorReference(area: string) {
  errorSequence += 1;
  const areaCode = area
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  const sequence = errorSequence.toString(36).toUpperCase().padStart(4, '0');

  return `HG-${areaCode}-${sequence}`;
}

function getErrorObject(error: unknown) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    return error as object;
  }

  return null;
}

export function reportClientError(
  error: unknown,
  context: ErrorReportContext,
): ClientErrorReport {
  const errorObject = getErrorObject(error);
  const reference =
    errorObject
      ? errorReferences.get(errorObject) ?? createErrorReference(context.area)
      : createErrorReference(context.area);

  if (errorObject) {
    errorReferences.set(errorObject, reference);

    if (!loggedErrors.has(errorObject)) {
      loggedErrors.add(errorObject);
      console.error('[Hasu Gallery]', reference, context, error);
    }
  } else {
    console.error('[Hasu Gallery]', reference, context, error);
  }

  return { reference };
}
