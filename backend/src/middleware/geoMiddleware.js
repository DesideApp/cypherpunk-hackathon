import geoip from 'geoip-lite';

export const detectCountry = async (req, _res, next) => {
  let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) ip = first;
  }

  let country = 'Unknown';
  if (ip) {
    const lookup = geoip.lookup(ip);
    if (lookup && lookup.country) {
      country = lookup.country;
    }
  }

  req.country = country;
  next();
};
