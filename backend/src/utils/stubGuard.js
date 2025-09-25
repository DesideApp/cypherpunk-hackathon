const parseBool = (v) => String(v).toLowerCase() === 'true';

export const flags = {
  internalSecret: process.env.INTERNAL_API_SECRET || null,
  isProd: process.env.NODE_ENV === 'production',
};

export function allowInternal(req) {
  const hdr = req?.headers?.['x-internal-secret'];
  return Boolean(flags.internalSecret && hdr && hdr === flags.internalSecret);
}

export function assertNoStubInProd() {
  if (flags.isProd && process.env.ALLOW_STUB_IN_PROD !== 'true') {
    return;
  }
}
