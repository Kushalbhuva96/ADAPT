const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false";

async function request(path, options={}) {
  const response = await fetch(`${BASE_URL}${path}`, {headers:{"Content-Type":"application/json",...(options.headers||{})}, ...options});
  const data = await response.json().catch(()=>({message:"Unexpected server response"}));
  if(!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
export const apiClient = { USE_MOCK, request, baseUrl:BASE_URL };
