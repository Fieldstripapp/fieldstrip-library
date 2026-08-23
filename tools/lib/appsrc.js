/* appsrc.js — READ-ONLY access to the fieldstrip-app repository.

   ⛔ EVERY READ GOES THROUGH `git show HEAD:<path>`, NEVER THROUGH THE FILESYSTEM.
   Two independent reasons, and either one alone would be enough:

     1. ANOTHER TERMINAL OWNS THAT REPO. The Clean lane authors specs there
        continuously. Reading its working tree would publish half-written specs
        and would make a publish unreproducible — the same command run twice
        would emit different bytes. HEAD is a fixed commit and can be named in
        the changelog.
     2. WE MUST NOT WRITE TO IT. `git show` cannot mutate a repo. No add, no
        stage, no index touch, no lock file. The app repo's git state is not
        ours and this module cannot alter it even by accident.

   ⛔ NOTHING HERE MAY WRITE. There is no fs.write* in this file and none may be
   added. The library repo is generated FROM the app repo; the arrow never
   reverses.
*/
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/* The app repo. Overridable so this is not wired to one machine's layout. */
const APP = process.env.FIELDSTRIP_APP ||
            path.resolve(__dirname, '..', '..', '..', 'fieldstrip-app');

function assertAppRepo() {
  if (!fs.existsSync(path.join(APP, '.git'))) {
    throw new Error('⛔ REFUSING — no git repo at ' + APP +
      '\n   Set FIELDSTRIP_APP to the fieldstrip-app checkout.');
  }
}

/* ⛔ execFileSync, NOT exec/execSync. A row id or path is never interpolated
   into a shell string, so no filename can ever be read as shell syntax. */
function git(args, opts) {
  assertAppRepo();
  return execFileSync('git', ['-C', APP].concat(args), Object.assign({
    maxBuffer: 256 * 1024 * 1024,
  }, opts || {}));
}

/** The commit every read in this publish resolves against. */
function head() {
  return git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function headSubject() {
  return git(['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim();
}

/** File content at HEAD, as UTF-8 text. */
function show(relPath) {
  return git(['show', 'HEAD:' + relPath], { encoding: 'utf8' });
}

/** File content at HEAD, as raw bytes. */
function showBytes(relPath) {
  return git(['show', 'HEAD:' + relPath]);
}

/** true if the path exists at HEAD. */
function exists(relPath) {
  try { git(['cat-file', '-e', 'HEAD:' + relPath]); return true; }
  catch (e) { return false; }
}

/** Every path at HEAD under `dir`, recursively. */
function lsTree(dir) {
  const out = git(['ls-tree', '-r', '--name-only', 'HEAD', dir], { encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

/** JSON at HEAD. Parse failure names the file — a bare SyntaxError does not. */
function showJson(relPath) {
  const raw = show(relPath);
  try { return JSON.parse(raw); }
  catch (e) { throw new Error('⛔ unparseable JSON at HEAD:' + relPath + ' — ' + e.message); }
}

module.exports = { APP, git, head, headSubject, show, showBytes, exists, lsTree, showJson };
