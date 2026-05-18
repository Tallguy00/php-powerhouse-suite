const API_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "ethiopower_token";

// =====================
// TOKEN TYPES + HELPERS
// =====================
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// =====================
// GENERIC REQUEST TYPES
// =====================
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
}

// =====================
// BASE FETCH WRAPPER
// =====================
async function request<TResponse = any, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data as TResponse;
}

// =====================
// BASIC ENTITY TYPES (OPTIONAL BUT USEFUL)
// =====================
export interface AuthResponse {
  token: string;
  user?: any;
}

export interface Customer {
  id: string;
  full_name: string;
  phone?: string;
}

export interface Meter {
  id: string;
  meter_number: string;
  customer_id: string;
}

export interface Bill {
  id: string;
  amount: number;
}

export interface Payment {
  id: string;
  status: string;
}

// =====================
// API OBJECT
// =====================
export const api = {
  // AUTH
  async register(form: any): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: form,
    });

    setToken(res.token);
    return res;
  },

  async login(form: any): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: form,
    });

    setToken(res.token);
    return res;
  },

  async logout(): Promise<any> {
    const res = await request("/api/auth/logout", {
      method: "POST",
    });

    setToken(null);
    return res;
  },

  async me(): Promise<any> {
    return request("/api/auth/me");
  },

  // CUSTOMERS
  async getCustomers(): Promise<Customer[]> {
    return request<Customer[]>("/api/customers");
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    return request<Customer, Partial<Customer>>("/api/customers", {
      method: "POST",
      body: data,
    });
  },

  // METERS
  async getMeters(): Promise<Meter[]> {
    return request<Meter[]>("/api/meters");
  },

  async createMeter(data: Partial<Meter>): Promise<Meter> {
    return request<Meter, Partial<Meter>>("/api/meters", {
      method: "POST",
      body: data,
    });
  },

  // BILLS
  async getBills(): Promise<Bill[]> {
    return request<Bill[]>("/api/bills");
  },

  async generateBill(data: any): Promise<Bill> {
    return request<Bill>("/api/bills", {
      method: "POST",
      body: data,
    });
  },

  // PAYMENTS
  async payBill(data: any): Promise<Payment> {
    return request<Payment>("/api/payments", {
      method: "POST",
      body: data,
    });
  },

  // DASHBOARD
  async getOverview(): Promise<any> {
    return request("/api/dashboard/overview");
  },

  // OUTAGES
  async getOutages(): Promise<any> {
    return request("/api/outages");
  },

  async reportOutage(data: any): Promise<any> {
    return request("/api/outages/report", {
      method: "POST",
      body: data,
    });
  },

  // TASKS
  async getTasks(): Promise<any[]> {
    return request("/api/tasks");
  },

  async getTechnicianHub(): Promise<any> {
    return request("/api/tasks/hub");
  },

  async updateTaskStatus(id: string, status: string): Promise<any> {
    return request(`/api/tasks/${id}`, {
      method: "PATCH",
      body: { status },
    });
  },

  // CONSUMPTION
  async getConsumption(): Promise<any> {
    return request("/api/consumption");
  },

  async getConsumptionSummary(): Promise<any> {
    return request("/api/consumption/summary");
  },

  // TARIFFS
  async getTariffs(): Promise<any> {
    return request("/api/tariffs");
  },

  async createTariff(data: any): Promise<any> {
    return request("/api/tariffs", {
      method: "POST",
      body: data,
    });
  },
};