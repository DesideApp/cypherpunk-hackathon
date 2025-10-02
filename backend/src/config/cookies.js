const truthy = new Set(['1', 'true', 'yes', 'on']);

const isDemo = truthy.has(String(process.env.DEMO_MODE || '').trim().toLowerCase());
const suffix = isDemo ? '_demo' : '';

export const COOKIE_NAMES = {
  accessToken: `accessToken${suffix}`,
  refreshToken: `refreshToken${suffix}`,
  csrfToken: `csrfToken${suffix}`,
};

export default COOKIE_NAMES;
