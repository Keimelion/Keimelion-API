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

interface MultipartRequestOptions {
  method?: string
  token?: string
  fields?: Record<string, string>
  image?: { buffer: Buffer; filename?: string; contentType?: string } | null
}

export async function apiMultipartRequest(
  path: string,
  options: MultipartRequestOptions = {},
): Promise<Response> {
  const form = new FormData()
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    form.append(key, value)
  }
  if (options.image) {
    const blob = new Blob([new Uint8Array(options.image.buffer)], {
      type: options.image.contentType ?? 'image/png',
    })
    form.append('image', blob, options.image.filename ?? 'upload.png')
  }

  const headers: Record<string, string> = {}
  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`

  const init: RequestInit = { headers, body: form }
  if (options.method !== undefined) init.method = options.method

  return app.request(path, init)
}
