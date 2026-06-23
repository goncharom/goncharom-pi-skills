#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args[key] = value
    index += 1
  }

  return args
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      buffer += chunk
    })
    process.stdin.on('end', () => resolve(buffer))
    process.stdin.on('error', reject)
  })
}

function escapeJsonForHtml(value) {
  return value
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

function normalizeNewlines(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n')
}

function splitContentLines(value) {
  const lines = normalizeNewlines(value).split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function normalizePath(value) {
  return String(value == null ? '' : value).replace(/\\/g, '/')
}

function toOptionalNumber(value) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(1, Math.trunc(numeric))
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' })
}

function compareNodes(a, b) {
  return compareText(a.group, b.group)
    || compareText(a.label, b.label)
    || compareText(a.kind, b.kind)
    || compareText(a.filePath, b.filePath)
    || compareText(a.symbol, b.symbol)
    || compareText(a.id, b.id)
}

function inferLanguage(filePath) {
  if (!filePath) return null

  const lowerPath = String(filePath).toLowerCase()
  const baseName = path.posix.basename(lowerPath)
  const extension = path.posix.extname(lowerPath)

  const byName = {
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    'cmakelists.txt': 'cmake',
    '.bashrc': 'bash',
    '.bash_profile': 'bash',
    '.zshrc': 'bash',
    '.zprofile': 'bash',
    '.gitignore': 'plaintext',
    '.gitattributes': 'plaintext',
    '.editorconfig': 'ini',
  }

  if (byName[baseName]) return byName[baseName]

  const byExtension = {
    '.c': 'c',
    '.cc': 'cpp',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.css': 'css',
    '.go': 'go',
    '.h': 'c',
    '.hpp': 'cpp',
    '.html': 'xml',
    '.htm': 'xml',
    '.ini': 'ini',
    '.java': 'java',
    '.js': 'javascript',
    '.json': 'json',
    '.jsx': 'javascript',
    '.lua': 'lua',
    '.md': 'markdown',
    '.php': 'php',
    '.py': 'python',
    '.rb': 'ruby',
    '.rs': 'rust',
    '.sh': 'bash',
    '.sql': 'sql',
    '.svg': 'xml',
    '.toml': 'toml',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.txt': 'plaintext',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.zsh': 'bash',
  }

  return byExtension[extension] || null
}

async function readInputText(inputPath) {
  if (inputPath) {
    return fs.readFileSync(inputPath, 'utf8')
  }

  if (process.stdin.isTTY) {
    throw new Error('Workflow graph JSON must be provided via stdin or --input <path>')
  }

  return readStdin()
}

function normalizeFiles(rawFiles) {
  const seenPaths = new Set()
  const files = []

  for (const rawFile of Array.isArray(rawFiles) ? rawFiles : []) {
    if (!rawFile || rawFile.path == null) continue

    const filePath = normalizePath(rawFile.path)
    if (!filePath || seenPaths.has(filePath)) continue

    const content = normalizeNewlines(rawFile.content)
    const lines = splitContentLines(content)

    files.push({
      ...rawFile,
      path: filePath,
      language: rawFile.language || inferLanguage(filePath),
      content,
      lineCount: lines.length,
    })

    seenPaths.add(filePath)
  }

  return files
}

function normalizeNodes(rawNodes) {
  const seenIds = new Set()
  const nodes = []

  for (const rawNode of Array.isArray(rawNodes) ? rawNodes : []) {
    if (!rawNode) continue

    let nodeId = rawNode.id == null ? `node-${nodes.length + 1}` : String(rawNode.id)
    if (!nodeId) nodeId = `node-${nodes.length + 1}`

    if (seenIds.has(nodeId)) {
      let suffix = 2
      while (seenIds.has(`${nodeId}-${suffix}`)) suffix += 1
      nodeId = `${nodeId}-${suffix}`
    }

    let lineStart = toOptionalNumber(rawNode.lineStart)
    let lineEnd = toOptionalNumber(rawNode.lineEnd)

    if (lineStart == null && lineEnd != null) lineStart = lineEnd
    if (lineStart != null && lineEnd == null) lineEnd = lineStart
    if (lineStart != null && lineEnd != null && lineEnd < lineStart) {
      lineEnd = lineStart
    }

    const omittedRaw = Number(rawNode.omittedCount)

    nodes.push({
      ...rawNode,
      id: nodeId,
      label: rawNode.label == null ? (rawNode.symbol == null ? nodeId : String(rawNode.symbol)) : String(rawNode.label),
      kind: rawNode.kind == null ? 'step' : String(rawNode.kind),
      filePath: rawNode.filePath == null ? '' : normalizePath(rawNode.filePath),
      symbol: rawNode.symbol == null ? '' : String(rawNode.symbol),
      group: rawNode.group == null ? '' : String(rawNode.group),
      lineStart,
      lineEnd,
      omittedCount: Number.isFinite(omittedRaw) ? Math.max(0, Math.trunc(omittedRaw)) : 0,
    })

    seenIds.add(nodeId)
  }

  return nodes
}

function normalizeEdges(rawEdges, nodeById) {
  const seenIds = new Set()
  const edges = []

  for (const rawEdge of Array.isArray(rawEdges) ? rawEdges : []) {
    if (!rawEdge || rawEdge.from == null || rawEdge.to == null) continue

    const from = String(rawEdge.from)
    const to = String(rawEdge.to)

    if (!nodeById.has(from) || !nodeById.has(to)) continue

    let edgeId = rawEdge.id == null ? `edge-${edges.length + 1}` : String(rawEdge.id)
    if (!edgeId) edgeId = `edge-${edges.length + 1}`

    if (seenIds.has(edgeId)) {
      let suffix = 2
      while (seenIds.has(`${edgeId}-${suffix}`)) suffix += 1
      edgeId = `${edgeId}-${suffix}`
    }

    edges.push({
      ...rawEdge,
      id: edgeId,
      from,
      to,
      kind: rawEdge.kind == null ? 'flows-to' : String(rawEdge.kind),
      evidence: rawEdge.evidence == null ? '' : String(rawEdge.evidence),
    })

    seenIds.add(edgeId)
  }

  return edges
}

function buildOrderedFiles(nodes, files) {
  const fileByPath = new Map(files.map((file) => [file.path, file]))
  const ordered = []
  const seenPaths = new Set()

  nodes.forEach((node) => {
    if (!node.filePath || !fileByPath.has(node.filePath) || seenPaths.has(node.filePath)) return
    ordered.push(fileByPath.get(node.filePath))
    seenPaths.add(node.filePath)
  })

  files
    .slice()
    .sort((a, b) => compareText(a.path, b.path))
    .forEach((file) => {
      if (seenPaths.has(file.path)) return
      ordered.push(file)
      seenPaths.add(file.path)
    })

  return ordered
}

function computeLayout(nodes, edges) {
  const nodeWidth = 248
  const nodeHeight = 76
  const horizontalGap = 76
  const verticalGap = 24
  const paddingX = 36
  const paddingY = 24

  if (!nodes.length) {
    return {
      width: 960,
      height: 520,
      nodeWidth,
      nodeHeight,
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map(nodes.map((node) => [node.id, []]))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))

  edges.forEach((edge) => {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return
    outgoing.get(edge.from).push(edge.to)
    if (edge.from !== edge.to) {
      indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1)
    }
  })

  const sortedIds = nodes.slice().sort(compareNodes).map((node) => node.id)
  const queue = sortedIds.filter((nodeId) => (indegree.get(nodeId) || 0) === 0)
  queue.sort((a, b) => compareNodes(nodeById.get(a), nodeById.get(b)))

  const order = []
  const inOrder = new Set()

  while (queue.length) {
    const nodeId = queue.shift()
    order.push(nodeId)
    inOrder.add(nodeId)

    outgoing.get(nodeId)
      .slice()
      .sort((a, b) => compareNodes(nodeById.get(a), nodeById.get(b)))
      .forEach((targetId) => {
        if (nodeId === targetId) return
        const next = (indegree.get(targetId) || 0) - 1
        indegree.set(targetId, next)
        if (next === 0) {
          queue.push(targetId)
          queue.sort((a, b) => compareNodes(nodeById.get(a), nodeById.get(b)))
        }
      })
  }

  sortedIds.forEach((nodeId) => {
    if (inOrder.has(nodeId)) return
    order.push(nodeId)
  })

  const orderIndex = new Map(order.map((nodeId, index) => [nodeId, index]))
  const forwardOutgoing = new Map(order.map((nodeId) => [nodeId, []]))
  const forwardIncoming = new Map(order.map((nodeId) => [nodeId, []]))

  edges.forEach((edge) => {
    if (edge.from === edge.to) return
    const fromIndex = orderIndex.get(edge.from)
    const toIndex = orderIndex.get(edge.to)
    if (fromIndex == null || toIndex == null || fromIndex >= toIndex) return
    forwardOutgoing.get(edge.from).push(edge.to)
    forwardIncoming.get(edge.to).push(edge.from)
  })

  const layerById = new Map(order.map((nodeId) => [nodeId, 0]))

  order.forEach((nodeId) => {
    const baseLayer = layerById.get(nodeId) || 0
    forwardOutgoing.get(nodeId).forEach((targetId) => {
      layerById.set(targetId, Math.max(layerById.get(targetId) || 0, baseLayer + 1))
    })
  })

  const nodeScore = (nodeId) => {
    const parents = forwardIncoming.get(nodeId) || []
    return parents.length
      ? parents.reduce((sum, parentId) => sum + (orderIndex.get(parentId) || 0), 0) / parents.length
      : (orderIndex.get(nodeId) || 0)
  }

  let columns
  const hasGroups = nodes.some((node) => node.group)

  if (hasGroups) {
    const groupMap = new Map()

    order.forEach((nodeId) => {
      const node = nodeById.get(nodeId)
      const layer = layerById.get(nodeId) || 0
      const groupKey = node.group || `layer:${layer}`
      const existing = groupMap.get(groupKey) || {
        key: groupKey,
        sortLayer: layer,
        sortLabel: node.group || groupKey,
        nodeIds: [],
      }
      existing.sortLayer = Math.min(existing.sortLayer, layer)
      existing.nodeIds.push(nodeId)
      groupMap.set(groupKey, existing)
    })

    columns = Array.from(groupMap.values())
      .sort((a, b) => a.sortLayer - b.sortLayer || compareText(a.sortLabel, b.sortLabel) || compareText(a.key, b.key))
  } else {
    const layerMap = new Map()

    order.forEach((nodeId) => {
      const layer = layerById.get(nodeId) || 0
      const list = layerMap.get(layer) || []
      list.push(nodeId)
      layerMap.set(layer, list)
    })

    columns = Array.from(layerMap.keys())
      .sort((a, b) => a - b)
      .map((layer) => ({
        key: `layer:${layer}`,
        sortLayer: layer,
        sortLabel: String(layer),
        nodeIds: (layerMap.get(layer) || []).slice(),
      }))
  }

  columns.forEach((column) => {
    column.nodeIds.sort((a, b) => nodeScore(a) - nodeScore(b) || compareNodes(nodeById.get(a), nodeById.get(b)))
  })

  if (columns.length > 6 && columns.every((column) => column.nodeIds.length === 1)) {
    const maxRowsPerColumn = Math.max(2, Math.ceil(nodes.length / 4))
    columns = []

    for (let index = 0; index < order.length; index += maxRowsPerColumn) {
      columns.push({
        key: `sequence:${columns.length + 1}`,
        sortLayer: columns.length,
        sortLabel: String(columns.length + 1),
        nodeIds: order.slice(index, index + maxRowsPerColumn),
      })
    }
  }

  const maxRows = Math.max(...columns.map((column) => column.nodeIds.length), 1)
  const stackHeight = maxRows * nodeHeight + Math.max(0, maxRows - 1) * verticalGap
  const width = paddingX * 2 + columns.length * nodeWidth + Math.max(0, columns.length - 1) * horizontalGap
  const height = paddingY * 2 + stackHeight

  const positionById = new Map()

  columns.forEach((column, columnIndex) => {
    const currentStackHeight = column.nodeIds.length * nodeHeight + Math.max(0, column.nodeIds.length - 1) * verticalGap
    const startY = paddingY + Math.max(0, (stackHeight - currentStackHeight) / 2)
    const x = paddingX + columnIndex * (nodeWidth + horizontalGap)

    column.nodeIds.forEach((nodeId, rowIndex) => {
      const y = startY + rowIndex * (nodeHeight + verticalGap)
      positionById.set(nodeId, { x, y, width: nodeWidth, height: nodeHeight, layer: column.sortLayer })
    })
  })

  return {
    width,
    height,
    nodeWidth,
    nodeHeight,
    positions: positionById,
  }
}

function resolveInitialSelection(rawSelection, nodes, files, nodeById, fileByPath) {
  const selection = rawSelection && typeof rawSelection === 'object' ? rawSelection : {}

  const requestedNodeId = selection.nodeId == null ? '' : String(selection.nodeId)
  const requestedFilePath = selection.filePath == null ? '' : normalizePath(selection.filePath)

  if (requestedNodeId && nodeById.has(requestedNodeId)) {
    const node = nodeById.get(requestedNodeId)
    return {
      nodeId: requestedNodeId,
      filePath: node.filePath || requestedFilePath || (files[0] ? files[0].path : ''),
    }
  }

  if (requestedFilePath && fileByPath.has(requestedFilePath)) {
    return {
      nodeId: '',
      filePath: requestedFilePath,
    }
  }

  if (nodes.length) {
    return {
      nodeId: nodes[0].id,
      filePath: nodes[0].filePath || (files[0] ? files[0].path : ''),
    }
  }

  if (files.length) {
    return {
      nodeId: '',
      filePath: files[0].path,
    }
  }

  return {
    nodeId: '',
    filePath: '',
  }
}

function buildWorkflowData(rawData, overrides) {
  const files = normalizeFiles(rawData.files)
  const fileByPath = new Map(files.map((file) => [file.path, file]))
  const nodes = normalizeNodes(rawData.nodes)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = normalizeEdges(rawData.edges, nodeById)
  const orderedFiles = buildOrderedFiles(nodes, files)
  const layout = computeLayout(nodes, edges)

  const positionedNodes = nodes.map((node) => {
    const position = layout.positions.get(node.id) || { x: 0, y: 0, width: layout.nodeWidth, height: layout.nodeHeight, layer: 0 }
    return {
      ...node,
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      layer: position.layer,
    }
  })

  const orderedFileByPath = new Map(orderedFiles.map((file) => [file.path, file]))
  const initialSelection = resolveInitialSelection(rawData.initialSelection, positionedNodes, orderedFiles, nodeById, orderedFileByPath)

  return {
    title: overrides.title || rawData.title || 'Workflow graph',
    question: overrides.question || rawData.question || '',
    generatedAt: overrides.generatedAt || rawData.generatedAt || '',
    sourcePath: overrides.sourcePath || rawData.sourcePath || overrides.outputPath || '',
    summary: {
      nodeCount: positionedNodes.length,
      edgeCount: edges.length,
      fileCount: orderedFiles.length,
    },
    layout: {
      width: layout.width,
      height: layout.height,
      nodeWidth: layout.nodeWidth,
      nodeHeight: layout.nodeHeight,
    },
    nodes: positionedNodes,
    edges,
    files: orderedFiles,
    initialSelection,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const templatePath = args.template
  const outputPath = args.out

  if (!templatePath || !outputPath) {
    throw new Error('Usage: build-workflow-html.js --template <path> --out <path> [--input <path>] [--title <title>] [--question <question>] [--generated-at <timestamp>] [--source-path <path>]')
  }

  const template = fs.readFileSync(templatePath, 'utf8')
  const inputText = await readInputText(args.input)
  const rawData = JSON.parse(normalizeNewlines(inputText))
  const data = buildWorkflowData(rawData, {
    title: args.title,
    question: args.question,
    generatedAt: args['generated-at'],
    sourcePath: args['source-path'],
    outputPath,
  })

  const serialized = escapeJsonForHtml(JSON.stringify(data, null, 2))

  if (!template.includes('__WORKFLOW_DATA_JSON__')) {
    throw new Error('Template is missing __WORKFLOW_DATA_JSON__ placeholder')
  }

  const html = template.replace('__WORKFLOW_DATA_JSON__', serialized)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, html, 'utf8')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
