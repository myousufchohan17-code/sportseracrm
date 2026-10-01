export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  let body = options.body
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, { ...options, headers, body })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text || 'Unexpected response' }
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export function upload(path, file, field = 'image') {
  const form = new FormData()
  form.append(field, file)
  return api(path, { method: 'POST', body: form })
}
