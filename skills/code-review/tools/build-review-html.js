#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }

  return args;
}

function escapeJsonForHtml(value) {
  return value
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}

function splitContentLines(value) {
  const lines = normalizeNewlines(value).split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function runGit(repoPath, args, options = {}) {
  try {
    return execFileSync('git', ['-C', repoPath, ...args], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : '';
    const stdout = error && error.stdout ? String(error.stdout).trim() : '';
    const detail = stderr || stdout || error.message || String(error);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function tryGit(repoPath, args, options = {}) {
  try {
    return {
      ok: true,
      value: runGit(repoPath, args, options),
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

function resolveRepoRoot(repoArg) {
  const candidate = path.resolve(repoArg || process.cwd());
  const result = tryGit(candidate, ['rev-parse', '--show-toplevel']);
  if (!result.ok) {
    throw new Error(`Not inside a git repo: ${candidate}`);
  }
  return normalizeNewlines(result.value).trim();
}

function hasHeadCommit(repoPath) {
  return tryGit(repoPath, ['rev-parse', '--verify', 'HEAD']).ok;
}

function listGitLines(repoPath, args) {
  const output = normalizeNewlines(runGit(repoPath, args));
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseDiffPath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/dev/null') return null;
  if (trimmed.startsWith('a/')) return trimmed.slice(2);
  if (trimmed.startsWith('b/')) return trimmed.slice(2);
  return trimmed;
}

function parseHunkHeader(line) {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] ? Number(match[2]) : 1,
    newStart: Number(match[3]),
    newCount: match[4] ? Number(match[4]) : 1,
  };
}

function noteRow(text) {
  return {
    kind: 'note',
    text,
  };
}

function hunkRow(text) {
  return {
    kind: 'hunk',
    text,
  };
}

function codeRow(kind, marker, oldLineNo, newLineNo, rawText) {
  return {
    kind,
    marker,
    oldLineNo,
    newLineNo,
    rawText,
  };
}

function inferLanguage(filePath) {
  if (!filePath) return null;

  const lowerPath = filePath.toLowerCase();
  const baseName = path.posix.basename(lowerPath);
  const extension = path.posix.extname(lowerPath);

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
  };

  if (byName[baseName]) return byName[baseName];

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
  };

  return byExtension[extension] || null;
}

function isBinaryBuffer(buffer) {
  const sampleSize = Math.min(buffer.length, 8192);
  for (let index = 0; index < sampleSize; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function isMiruPath(filePath) {
  if (!filePath) return false;
  return filePath === '.miru' || filePath.startsWith('.miru/') || filePath.includes('/.miru/');
}

function shouldIncludeFile(file) {
  if (!file) return false;
  return ![file.path, file.oldPath, file.newPath].some((candidate) => isMiruPath(candidate));
}

function parseUnifiedDiff(diffText) {
  const lines = splitContentLines(diffText);
  const files = [];

  let current = null;
  let currentOldLine = 0;
  let currentNewLine = 0;
  let inHunk = false;

  function startFile(line) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    current = {
      path: null,
      oldPath: match ? match[1] : null,
      newPath: match ? match[2] : null,
      status: null,
      language: null,
      additions: 0,
      deletions: 0,
      renameFrom: null,
      renameTo: null,
      binary: false,
      binaryText: '',
      notes: [],
      rows: [],
    };
    inHunk = false;
  }

  function finishFile() {
    if (!current) return;

    if (current.renameFrom) current.oldPath = current.renameFrom;
    if (current.renameTo) current.newPath = current.renameTo;

    if (current.binary) {
      current.status = current.status || 'binary';
      current.notes.push(current.binaryText || 'Binary file changed.');
    }

    if (current.renameFrom || current.renameTo) {
      current.status = 'renamed';
    } else if (!current.status) {
      if (!current.oldPath && current.newPath) current.status = 'added';
      else if (current.oldPath && !current.newPath) current.status = 'deleted';
      else current.status = 'modified';
    }

    current.path = current.newPath || current.oldPath || current.renameTo || current.renameFrom || '(unknown path)';
    current.language = inferLanguage(current.path);

    current.additions = current.rows.filter((row) => row.kind === 'add').length;
    current.deletions = current.rows.filter((row) => row.kind === 'delete').length;

    if (!current.rows.length) {
      if (current.notes.length) {
        current.notes.forEach((text) => current.rows.push(noteRow(text)));
      } else if (current.status === 'renamed' && current.oldPath && current.newPath) {
        current.rows.push(noteRow('Rename without inline content changes.'));
      } else {
        current.rows.push(noteRow('No inline diff rows for this change.'));
      }
    } else if (current.notes.length) {
      current.notes.forEach((text) => current.rows.push(noteRow(text)));
    }

    current.id = `file-${files.length + 1}`;
    let commentableIndex = 0;
    current.rows = current.rows.map((row) => {
      if (row.kind === 'context' || row.kind === 'add' || row.kind === 'delete') {
        commentableIndex += 1;
        return {
          ...row,
          id: `${current.path}:${row.oldLineNo == null ? '-' : row.oldLineNo}:${row.newLineNo == null ? '-' : row.newLineNo}:${commentableIndex}`,
        };
      }
      return row;
    });

    files.push(current);
    current = null;
    inHunk = false;
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      finishFile();
      startFile(line);
      continue;
    }

    if (!current) continue;

    if (line.startsWith('new file mode ')) {
      current.status = 'added';
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      current.status = 'deleted';
      continue;
    }

    if (line.startsWith('rename from ')) {
      current.renameFrom = line.slice('rename from '.length);
      continue;
    }

    if (line.startsWith('rename to ')) {
      current.renameTo = line.slice('rename to '.length);
      continue;
    }

    if (line.startsWith('Binary files ')) {
      current.binary = true;
      current.binaryText = line;
      inHunk = false;
      continue;
    }

    if (line.startsWith('Submodule ')) {
      current.notes.push(line);
      continue;
    }

    if (line.startsWith('--- ')) {
      current.oldPath = parseDiffPath(line.slice(4));
      continue;
    }

    if (line.startsWith('+++ ')) {
      current.newPath = parseDiffPath(line.slice(4));
      continue;
    }

    if (line.startsWith('@@ ')) {
      const parsed = parseHunkHeader(line);
      if (!parsed) continue;
      currentOldLine = parsed.oldStart;
      currentNewLine = parsed.newStart;
      current.rows.push(hunkRow(line));
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      current.rows.push(codeRow('add', '+', null, currentNewLine, line.slice(1)));
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      current.rows.push(codeRow('delete', '-', currentOldLine, null, line.slice(1)));
      currentOldLine += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      current.rows.push(codeRow('context', ' ', currentOldLine, currentNewLine, line.slice(1)));
      currentOldLine += 1;
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith('\\')) {
      current.rows.push(noteRow(line));
    }
  }

  finishFile();
  return files;
}

function buildSyntheticAddedFile(repoPath, relativePath, status = 'untracked') {
  const absolutePath = path.join(repoPath, relativePath);
  const buffer = fs.readFileSync(absolutePath);
  const binary = isBinaryBuffer(buffer);

  const file = {
    id: '',
    path: relativePath,
    oldPath: null,
    newPath: relativePath,
    status,
    language: inferLanguage(relativePath),
    additions: 0,
    deletions: 0,
    rows: [],
  };

  if (binary) {
    file.rows.push(noteRow(status === 'untracked' ? 'Untracked binary file.' : 'Binary file added.'));
    return file;
  }

  const content = normalizeNewlines(buffer.toString('utf8'));
  const lines = splitContentLines(content);

  if (lines.length) {
    file.rows.push(hunkRow(`@@ -0,0 +1,${lines.length} @@`));
    lines.forEach((lineText, index) => {
      file.rows.push(codeRow('add', '+', null, index + 1, lineText));
    });
    file.additions = lines.length;
  } else {
    file.rows.push(noteRow('Empty file.'));
  }

  return file;
}

function assignSyntheticIds(files, startingIndex = 0) {
  files.forEach((file, fileOffset) => {
    file.id = `file-${startingIndex + fileOffset + 1}`;
    let commentableIndex = 0;
    file.rows = file.rows.map((row) => {
      if (row.kind === 'context' || row.kind === 'add' || row.kind === 'delete') {
        commentableIndex += 1;
        return {
          ...row,
          id: `${file.path}:${row.oldLineNo == null ? '-' : row.oldLineNo}:${row.newLineNo == null ? '-' : row.newLineNo}:${commentableIndex}`,
        };
      }
      return row;
    });
  });
  return files;
}

function buildReviewData({ title, generatedAt, sourcePath, repoPath, baseRef, headRef }) {
  const hasExplicitRange = Boolean(baseRef || headRef);

  if (hasExplicitRange && (!baseRef || !headRef)) {
    throw new Error('Both --base and --head are required when specifying a commit delta');
  }

  const reviewMode = hasExplicitRange
    ? `commit-delta:${baseRef}..${headRef}`
    : 'working-tree-vs-head-plus-untracked';
  const hasHead = hasHeadCommit(repoPath);

  let files = [];

  if (hasExplicitRange) {
    const diffText = runGit(repoPath, ['diff', '--no-color', '--find-renames', '--unified=3', '--no-ext-diff', baseRef, headRef]);
    files = parseUnifiedDiff(diffText);
    files = files.filter(shouldIncludeFile);
  } else if (hasHead) {
    const diffText = runGit(repoPath, ['diff', 'HEAD', '--no-color', '--find-renames', '--unified=3', '--no-ext-diff']);
    files = parseUnifiedDiff(diffText);

    files = files.filter(shouldIncludeFile);

    const untrackedPaths = listGitLines(repoPath, ['ls-files', '--others', '--exclude-standard'])
      .filter((relativePath) => !isMiruPath(relativePath));
    const syntheticFiles = assignSyntheticIds(
      untrackedPaths.map((relativePath) => buildSyntheticAddedFile(repoPath, relativePath, 'untracked')),
      files.length,
    );
    files = files.concat(syntheticFiles);
  } else {
    const trackedPaths = listGitLines(repoPath, ['ls-files']).filter((relativePath) => !isMiruPath(relativePath));
    const untrackedPaths = listGitLines(repoPath, ['ls-files', '--others', '--exclude-standard'])
      .filter((relativePath) => !isMiruPath(relativePath));
    const allPaths = Array.from(new Set([...trackedPaths, ...untrackedPaths])).sort();
    files = assignSyntheticIds(
      allPaths.map((relativePath) => buildSyntheticAddedFile(repoPath, relativePath, 'added')),
      0,
    );
  }

  files = files.filter(shouldIncludeFile);

  const summary = files.reduce(
    (accumulator, file) => {
      accumulator.fileCount += 1;
      accumulator.additions += file.additions || 0;
      accumulator.deletions += file.deletions || 0;
      return accumulator;
    },
    { fileCount: 0, additions: 0, deletions: 0 },
  );

  return {
    title,
    generatedAt,
    sourcePath,
    repoPath,
    reviewMode,
    summary,
    files,
    emptyMessage: 'No changed files to review.',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const templatePath = args.template;
  const outputPath = args.out;
  const repoPath = resolveRepoRoot(args.repo || process.cwd());
  const title = args.title || `Code review: ${path.basename(repoPath)}`;
  const generatedAt = args['generated-at'] || '';
  const sourcePath = args['source-path'] || outputPath;

  if (!templatePath || !outputPath) {
    throw new Error('Usage: build-review-html.js --template <path> --out <path> [--title <title>] [--generated-at <timestamp>] [--source-path <path>] [--repo <path>] [--base <rev> --head <rev>]');
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const data = buildReviewData({
    title,
    generatedAt,
    sourcePath,
    repoPath,
    baseRef: args.base,
    headRef: args.head,
  });
  const serialized = escapeJsonForHtml(JSON.stringify(data, null, 2));

  if (!template.includes('__REVIEW_DATA_JSON__')) {
    throw new Error('Template is missing __REVIEW_DATA_JSON__ placeholder');
  }

  const html = template.replace('__REVIEW_DATA_JSON__', () => serialized);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
