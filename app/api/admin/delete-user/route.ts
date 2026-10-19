import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STORAGE_BUCKET = 'print-files'
const STORAGE_PAGE_SIZE = 1000

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function listUserFiles(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  folder: string,
): Promise<string[]> {
  const filePaths: string[] = []

  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data: entries, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(folder, { limit: STORAGE_PAGE_SIZE, offset })
    if (error) throw new Error(`Could not list user print files: ${error.message}`)

    for (const entry of entries) {
      const path = `${folder}/${entry.name}`
      if (entry.id === null) {
        filePaths.push(...(await listUserFiles(supabaseAdmin, path)))
      } else {
        filePaths.push(path)
      }
    }

    if (entries.length < STORAGE_PAGE_SIZE) break
  }

  return filePaths
}

export async function POST(request: Request) {
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (error) {
    console.error('Admin user deletion authentication configuration error:', error)
    return jsonError('Authentication is not configured on the server.', 503)
  }

  let user
  try {
    const {
      data: { user: authenticatedUser },
      error,
    } = await supabase.auth.getUser()
    if (error) throw error
    if (!authenticatedUser) return jsonError('User not authenticated.', 401)
    user = authenticatedUser
  } catch (error) {
    console.error('Admin user deletion authentication failed:', error)
    return jsonError('Could not verify the signed-in user.', 503)
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Admin user deletion configuration error:', error)
    return jsonError('User deletion is not configured on the server.', 503)
  }

  const { data: operator, error: operatorError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (operatorError) {
    console.error('Admin user deletion operator lookup failed:', operatorError)
    return jsonError('Could not verify operator access.', 503)
  }
  if (operator?.role !== 'operator') {
    return jsonError('Unauthorized: Operator access required.', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Request must contain valid JSON.', 400)
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('userId' in body) ||
    typeof body.userId !== 'string' ||
    !UUID_PATTERN.test(body.userId)
  ) {
    return jsonError('A valid user ID is required.', 400)
  }

  const userId = body.userId
  if (userId === user.id) {
    return jsonError('You cannot delete your own operator account.', 400)
  }

  try {
    const filePaths = await listUserFiles(supabaseAdmin, userId)
    for (let index = 0; index < filePaths.length; index += STORAGE_PAGE_SIZE) {
      const { error: removeError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove(filePaths.slice(index, index + STORAGE_PAGE_SIZE))
      if (removeError) throw new Error(`Could not delete user print files: ${removeError.message}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Admin user print-file deletion failed:', error)
    return jsonError(message, 500)
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('Admin auth user deletion failed:', deleteError)
    return jsonError(deleteError.message, 500)
  }

  return NextResponse.json({ success: true, message: 'Account completely deleted.' })
}
