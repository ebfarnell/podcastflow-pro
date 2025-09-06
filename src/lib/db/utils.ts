// Get schema name from organization slug
export function getSchemaName(orgSlug: string): string {
  const sanitized = orgSlug.toLowerCase().replace(/-/g, '_')
  return `org_${sanitized}`
}