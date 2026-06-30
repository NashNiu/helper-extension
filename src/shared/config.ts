// import.meta.env.DEV 在 vite build 下为 false，dev 下为 true
export const API_BASE = import.meta.env.DEV
  ? "http://localhost:3001"
  : "https://helper-backend-production-6abe.up.railway.app";

export const TOKEN_KEY = "helper.auth.token";
