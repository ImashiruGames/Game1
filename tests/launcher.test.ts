import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const batchBytes = readFileSync(new URL('../start-game.bat', import.meta.url));
const batch = batchBytes.toString('utf8');

// 日本語: LinuxではWindowsのcmd.exeを実行できないため、これは静的検証。
// English: These checks validate launcher structure, not real Windows execution.
test('Windows launcher uses CRLF, no BOM, quoted script path, and disabled delayed expansion', () => {
  assert.equal(batchBytes[0], '@'.charCodeAt(0));
  assert.ok(batch.includes('\r\n'));
  assert.equal(batch.replaceAll('\r\n', '').includes('\n'), false);
  assert.ok(batch.includes('setlocal EnableExtensions DisableDelayedExpansion'));
  assert.ok(batch.includes('pushd "%~dp0"'));
  assert.ok(batch.includes('pause >nul'));
  assert.ok(batch.includes('where npm.cmd >nul 2>&1'));
});

test('Node version gate accepts 24+ and rejects older or invalid versions', () => {
  const line = batch.split('\r\n').find(line => line.startsWith('node.exe -e '));
  assert.ok(line);
  const expression = line.slice('node.exe -e "'.length, -1);
  for (const [version, expected] of [['23.11.1', 1], ['22.0.0', 1], ['24.0.0', 0], ['24.19.0', 0], ['26.0.0', 0], ['unknown', 1]] as const) {
    let status: number | undefined;
    runInNewContext(expression, { process: { versions: { node: version }, exit(code: number) { status = code; } } });
    assert.equal(status, expected, version);
  }
});

test('launcher installs absent dependencies and preserves loopback-only Vite configuration', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: { dev: string } };
  assert.ok(batch.includes('if not exist "node_modules\\" goto install_dependencies'));
  assert.ok(batch.includes('call npm.cmd ci --include=dev'));
  assert.ok(batch.includes('call npm.cmd run dev -- --open'));
  assert.equal(pkg.scripts.dev, 'vite --host 127.0.0.1');
  assert.ok(batch.includes('if errorlevel 1 goto install_error'));
  assert.ok(batch.includes('if errorlevel 1 goto launch_error'));
  assert.ok(batch.includes(':node_missing'));
  assert.ok(batch.includes(':node_version_error'));
  assert.ok(batch.includes(':npm_missing'));
  assert.ok(batch.includes('Use the Local URL printed by Vite below.'));
  assert.equal(batch.includes('http://127.0.0.1:5173/'), false, 'launcher must use the actual Vite URL');
});
