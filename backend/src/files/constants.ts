// Keep in sync with frontend/.env.local's NEXT_PUBLIC_UPLOAD_MAX_SIZE.
// Hardcoded rather than env-driven: class-validator decorator arguments
// (e.g. @Max(...) below) are evaluated at import time, before
// ConfigModule.forRoot()'s dotenv load has run, so reading process.env
// here would silently see undefined.
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
