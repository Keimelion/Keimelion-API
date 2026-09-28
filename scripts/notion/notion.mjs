#!/usr/bin/env node
// Minimal Notion REST wrapper used by the dev agent instead of the Notion MCP server.
// Reads NOTION_TOKEN from the environment.
// Prints compact JSON on stdout; errors go to stderr with a non-zero exit code.

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = process.env.NOTION_VERSION ?? '2022-06-28'

const NOTION_TOKEN = process.env.NOTION_TOKEN

const [, , command, ...args] = process.argv

function normalizeId(id) {
  const clean = id.replace(/[^0-9a-fA-F]/g, '')
  if (clean.length !== 32) return id
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
}

async function notionFetch(path, init = {}) {
  if (!NOTION_TOKEN) {
    console.error('NOTION_TOKEN env var is required')
    process.exit(3)
  }
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await response.text()
  if (!response.ok) {
    console.error(`Notion API ${response.status} on ${path}: ${body}`)
    process.exit(2)
  }
  return body ? JSON.parse(body) : {}
}

function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return ''
  return richText.map((node) => node.plain_text ?? '').join('')
}

function extractPropertyValue(property) {
  switch (property.type) {
    case 'title': return richTextToPlain(property.title)
    case 'rich_text': return richTextToPlain(property.rich_text)
    case 'select': return property.select?.name ?? null
    case 'status': return property.status?.name ?? null
    case 'multi_select': return property.multi_select.map((option) => option.name)
    case 'url': return property.url
    case 'email': return property.email
    case 'phone_number': return property.phone_number
    case 'number': return property.number
    case 'checkbox': return property.checkbox
    case 'date': return property.date
    case 'people': return property.people.map((person) => person.name ?? person.id)
    case 'relation': return property.relation.map((relation) => relation.id)
    case 'unique_id': {
      const prefix = property.unique_id.prefix
      const number = property.unique_id.number
      return prefix ? `${prefix}-${number}` : String(number)
    }
    case 'formula': {
      const formula = property.formula
      return formula[formula.type] ?? null
    }
    default: return null
  }
}

async function fetchPageBlocks(pageId) {
  const collected = []
  let cursor
  do {
    const query = cursor ? `?start_cursor=${cursor}` : ''
    const page = await notionFetch(`/blocks/${pageId}/children${query}`)
    collected.push(...page.results)
    cursor = page.has_more ? page.next_cursor : null
  } while (cursor)
  return collected
}

function blocksToPlain(blocks) {
  return blocks
    .map((block) => {
      const value = block[block.type]
      if (value?.rich_text) return richTextToPlain(value.rich_text)
      return ''
    })
    .filter((line) => line.length > 0)
    .join('\n')
}

async function fetchPageComments(pageId) {
  const collected = []
  let cursor
  do {
    const query = cursor ? `&start_cursor=${cursor}` : ''
    const page = await notionFetch(`/comments?block_id=${pageId}${query}`)
    collected.push(...page.results)
    cursor = page.has_more ? page.next_cursor : null
  } while (cursor)
  return collected.map((comment) => ({
    id: comment.id,
    created_time: comment.created_time,
    created_by: comment.created_by?.id,
    text: richTextToPlain(comment.rich_text),
    parent_discussion_id: comment.discussion_id,
  }))
}

async function fetchBlockedByTickets(relationIds) {
  const results = []
  for (const relationId of relationIds) {
    const page = await notionFetch(`/pages/${relationId}`)
    const properties = page.properties ?? {}
    const titleProperty = Object.values(properties).find((property) => property.type === 'title')
    const statusProperty = properties.Status
    results.push({
      id: page.id,
      url: page.url,
      title: titleProperty ? richTextToPlain(titleProperty.title) : null,
      status: statusProperty ? extractPropertyValue(statusProperty) : null,
    })
  }
  return results
}

async function getPage(rawId) {
  const pageId = normalizeId(rawId)
  const page = await notionFetch(`/pages/${pageId}`)
  const rawProperties = page.properties ?? {}
  const properties = {}
  let title = null
  for (const [name, property] of Object.entries(rawProperties)) {
    const value = extractPropertyValue(property)
    properties[name] = value
    if (property.type === 'title') title = value
  }
  const [blocks, comments] = await Promise.all([
    fetchPageBlocks(pageId),
    fetchPageComments(pageId),
  ])
  const body = blocksToPlain(blocks)
  const blockedByIds = Array.isArray(rawProperties['Blocked By']?.relation)
    ? rawProperties['Blocked By'].relation.map((relation) => relation.id)
    : []
  const blockedBy = blockedByIds.length > 0 ? await fetchBlockedByTickets(blockedByIds) : []
  const output = {
    id: page.id,
    url: page.url,
    title,
    properties,
    body,
    blocked_by: blockedBy,
    comments,
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

async function getPropertyType(pageId, propertyName) {
  const page = await notionFetch(`/pages/${pageId}`)
  const property = page.properties?.[propertyName]
  if (!property) {
    console.error(`Property "${propertyName}" not found on page ${pageId}`)
    process.exit(2)
  }
  return property.type
}

function buildPropertyPatch(type, rawValue) {
  switch (type) {
    case 'status': return { status: { name: rawValue } }
    case 'select': return { select: { name: rawValue } }
    case 'multi_select': {
      const names = rawValue.split(',').map((name) => name.trim()).filter(Boolean)
      return { multi_select: names.map((name) => ({ name })) }
    }
    case 'url': return { url: rawValue }
    case 'email': return { email: rawValue }
    case 'phone_number': return { phone_number: rawValue }
    case 'number': return { number: Number(rawValue) }
    case 'checkbox': return { checkbox: rawValue === 'true' }
    case 'title': return { title: [{ type: 'text', text: { content: rawValue } }] }
    case 'rich_text': return { rich_text: [{ type: 'text', text: { content: rawValue } }] }
    default:
      console.error(`Unsupported property type: ${type}`)
      process.exit(1)
  }
}

async function setProperty(rawId, propertyName, rawValue) {
  const pageId = normalizeId(rawId)
  const type = await getPropertyType(pageId, propertyName)
  const patch = buildPropertyPatch(type, rawValue)
  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { [propertyName]: patch } }),
  })
  process.stdout.write(`Updated ${propertyName} on ${pageId}\n`)
}

async function setStatus(rawId, status) {
  await setProperty(rawId, 'Status', status)
}

async function addComment(rawId, text) {
  const pageId = normalizeId(rawId)
  await notionFetch('/comments', {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: text } }],
    }),
  })
  process.stdout.write(`Comment added to ${pageId}\n`)
}

function printUsage() {
  process.stdout.write([
    'Usage: node scripts/notion/notion.mjs <command> [args...]',
    '',
    'Commands:',
    '  get-page <page-id>',
    '  set-status <page-id> <status>              # convenience for the Status property',
    '  set-property <page-id> <name> <value>      # any property; type auto-detected',
    '  add-comment <page-id> <text>',
    '',
    'Env:',
    '  NOTION_TOKEN     (required) Notion integration secret',
    '  NOTION_VERSION   (optional) Notion API version, default 2022-06-28',
    '',
  ].join('\n'))
}

async function main() {
  switch (command) {
    case 'get-page': {
      if (!args[0]) { printUsage(); process.exit(1) }
      await getPage(args[0])
      return
    }
    case 'set-status': {
      if (!args[0] || !args[1]) { printUsage(); process.exit(1) }
      await setStatus(args[0], args[1])
      return
    }
    case 'set-property': {
      if (!args[0] || !args[1] || args[2] === undefined) { printUsage(); process.exit(1) }
      await setProperty(args[0], args[1], args[2])
      return
    }
    case 'add-comment': {
      if (!args[0] || !args[1]) { printUsage(); process.exit(1) }
      await addComment(args[0], args[1])
      return
    }
    case 'help':
    case '--help':
    case undefined:
      printUsage()
      return
    default:
      console.error(`Unknown command: ${command}`)
      printUsage()
      process.exit(1)
  }
}

await main()
