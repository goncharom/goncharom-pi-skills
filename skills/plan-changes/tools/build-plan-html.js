#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

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

function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });
}

function escapeJsonForHtml(value) {
  return value
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const templatePath = args.template;
  const outputPath = args.out;
  const title = args.title;
  const generatedAt = args['generated-at'] || '';
  const sourcePath = args['source-path'] || outputPath;

  if (!templatePath || !outputPath || !title) {
    throw new Error('Usage: build-plan-html.js --template <path> --out <path> --title <title> [--generated-at <timestamp>] [--source-path <path>]');
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const planText = (await readStdin()).replace(/\r\n/g, '\n');
  const planLines = planText.split('\n');
  if (planLines.length > 1 && planLines[planLines.length - 1] === '') {
    planLines.pop();
  }

  const data = {
    title,
    generatedAt,
    sourcePath,
    planLines: planLines.length ? planLines : [''],
  };

  const serialized = escapeJsonForHtml(JSON.stringify(data, null, 2));

  if (!template.includes('__PLAN_DATA_JSON__')) {
    throw new Error('Template is missing __PLAN_DATA_JSON__ placeholder');
  }

  const html = template.replace('__PLAN_DATA_JSON__', serialized);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
