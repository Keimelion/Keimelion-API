import { app } from '../../app.js'

interface ApiRequestOptions {
  method?: string
  token?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers }
  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const init: RequestInit = { headers }
  if (options.method !== undefined) init.method = options.method
  if (options.body !== undefined) init.body = JSON.stringify(options.body)

  return app.request(path, init)
}
