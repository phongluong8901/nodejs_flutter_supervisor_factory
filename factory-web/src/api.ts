export type Sensor = { value: number; unit: string; level: 'GREEN' | 'YELLOW' | 'RED'; is_online: boolean; updated_at: string };
export type Device = { name: string; category: string; icon: string; power: number; rated_power?: number; is_on: boolean; status: string; runtime: number; health: number };
export type FactoryStatus = { iot_sensors: Record<string, Sensor>; devices_control: Record<string, Device>; last_seen?: string };
export type User = { id: string; email: string; name?: string; age?: number | null; phone?: string; address?: string; avatarUrl?: string };
export type AlertLog = { id: string; title: string; message: string; type: 'warning' | 'info'; sensor?: string | null; is_read: boolean; createdAt: string; updatedAt?: string };
export type TelemetryPoint = { timestamp: string; sensors: Record<string, Sensor>; devices_control: Record<string, Device> };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'factory_web_token';
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '';

export const api = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  async uploadAvatar(file: File): Promise<string> {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error('Thiếu cấu hình Cloudinary. Vui lòng thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET.');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });

    const data = await response.json().catch(() => ({} as { secure_url?: string; error?: { message?: string } }));
    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Không thể tải ảnh lên Cloudinary.');
    }

    return data.secure_url as string;
  },
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const result = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const result = await request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }, false);
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  logout() { localStorage.removeItem(TOKEN_KEY); },
  async status() { return request<FactoryStatus>('/iot/status'); },
  async profile() { return request<User>('/auth/me'); },
  async updateProfile(updates: Partial<Pick<User, 'name' | 'age' | 'phone' | 'address' | 'avatarUrl'>>) {
    return request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(updates) });
  },
  async logs() { return request<AlertLog[]>('/iot/logs'); },
  async telemetry(limit = 120) { return request<TelemetryPoint[]>(`/iot/telemetry?limit=${limit}`); },
  async resetDevice(name: string) {
    return request<{ success: boolean }>(`/iot/devices/${encodeURIComponent(name)}/reset-health`, { method: 'POST' });
  },
  async control(name: string, is_on: boolean) {
    return request<{ success: boolean }>('/iot/control', {
      method: 'POST',
      body: JSON.stringify({ name, is_on }),
    });
  },
  async updateDevice(name: string, updates: Partial<Pick<Device, 'name' | 'power' | 'runtime'>>) {
    return request<{ success: boolean }>(`/iot/devices/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated && api.token) headers.set('Authorization', `Bearer ${api.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body as T;
}
