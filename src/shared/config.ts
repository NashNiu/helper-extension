// import.meta.env.DEV 在 vite build 下为 false，dev 下为 true
export const API_BASE = import.meta.env.DEV
  ? "http://localhost:3001"
  : "https://helper-backend-sigma.vercel.app";

export const TOKEN_KEY = "helper.auth.token";
