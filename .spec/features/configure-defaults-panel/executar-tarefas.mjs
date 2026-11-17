#!/usr/bin/env node
// Gerado pelo onp-spec. Executor portátil; usa somente Node e o CLI nativo.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL("../../../", import.meta.url));
const engine = path.resolve(root, ".agents/skills/onp-spec-driven/scripts/onp-spec.mjs");
const child = spawn(process.execPath, [engine, 'executar', "configure-defaults-panel", ...process.argv.slice(2), '--run', "task-bar-reminder-configure-defaults-panel-mwl21z03-e8b63162"], { cwd: root, stdio: 'inherit', shell: false });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 2; });
child.on('exit', code => { process.exitCode = code ?? 1; });
