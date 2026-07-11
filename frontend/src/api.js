const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "No se pudo completar la operación.";
    throw new Error(detail);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  summary: () => request("/api/summary"),
  transactions: () => request("/api/transactions"),
  budgets: () => request("/api/budgets"),
  tickets: () => request("/api/tickets"),
  interpret: (message) => request("/api/agent/interpret", {
    method: "POST",
    body: JSON.stringify({ message }),
  }),
  confirm: (draft) => request("/api/transactions/confirm", {
    method: "POST",
    body: JSON.stringify({ draft, confirmed: true }),
  }),
  saveBudget: (budget) => request("/api/budgets", {
    method: "POST",
    body: JSON.stringify(budget),
  }),
  support: (message) => request("/api/support", {
    method: "POST",
    body: JSON.stringify({ message }),
  }),
  createTicket: (ticket) => request("/api/tickets", {
    method: "POST",
    body: JSON.stringify({ ...ticket, confirmed: true }),
  }),
  updateTicketStatus: (ticketId, status) => request(`/api/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
};
