if (!import.meta.env.VITE_BACKEND_URL) {
    throw new Error("❌ VITE_BACKEND_URL no está definido en el entorno.");
  }
  
  export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "");
  