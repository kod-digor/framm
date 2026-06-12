#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MESSAGES_PATH = join(ROOT, "messages/fr.json");
const SRC_DIR = join(ROOT, "src");

const messages = JSON.parse(readFileSync(MESSAGES_PATH, "utf8"));

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      entries.push(...walk(path));
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      entries.push(path);
    }
  }
  return entries;
}

function hasKey(namespace, key) {
  const section = messages[namespace];
  if (!section) return false;

  let current = section;
  for (const part of key.split(".")) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

const files = walk(SRC_DIR);
const missing = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  const translators = [
    ...content.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getT|useTranslations)\(\s*["']([^"']+)["']\s*\)/g
    ),
  ];

  if (translators.length === 0) continue;

  for (const [, varName, namespace] of translators) {
    const calls = [
      ...content.matchAll(new RegExp(`\\b${varName}\\(\\s*["']([^"']+)["']`, "g")),
    ];

    for (const [, key] of calls) {
      if (!hasKey(namespace, key)) {
        missing.push({ file: rel, namespace, key, varName });
      }
    }
  }
}

const unique = [
  ...new Map(missing.map((m) => [`${m.namespace}.${m.key}@${m.file}`, m])).values(),
];

if (unique.length > 0) {
  console.error("Clés i18n manquantes dans messages/fr.json :\n");
  for (const { file, namespace, key } of unique) {
    console.error(`  - ${namespace}.${key} (utilisée dans ${file})`);
  }
  process.exit(1);
}

console.log("i18n OK — toutes les clés référencées existent dans messages/fr.json");
