const NS = 'wa:';

export const storage = {
  get: (k: string) => {
    try { return localStorage.getItem(NS + k); } catch { return null; }
  },
  set: (k: string, v: string) => { 
    try { localStorage.setItem(NS + k, v); } catch {} 
  },
  rm: (k: string) => { 
    try { localStorage.removeItem(NS + k); } catch {} 
  },
};
