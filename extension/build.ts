import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dir, '..')
for (const command of [['bunx','tsgo','-p','extension/tsconfig.json'], ['bunx','vite','build','--config','extension/vite.config.ts']]) {
  const run = Bun.spawn(command, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  if (await run.exited !== 0) process.exit(1)
}
// The single host permission must match the app host compiled into the popup.
const manifest = JSON.parse(await readFile(resolve(root,'extension/manifest.json'),'utf8'))
const app = process.env['VITE_WEOREX_APP_URL']
if (app) manifest.host_permissions = manifest.externally_connectable.matches = [`${new URL(app).origin}/*`]
await writeFile(resolve(root,'extension/dist/manifest.json'),JSON.stringify(manifest,null,2))
await copyFile(resolve(root,'extension/INSTALL.md'),resolve(root,'extension/dist/INSTALL.md'))
const archive = '/tmp/weorex-capture.zip'
const zip = Bun.spawn(['python3','-c',`import pathlib,zipfile
root=pathlib.Path(${JSON.stringify(resolve(root,'extension/dist'))})
with zipfile.ZipFile(${JSON.stringify(archive)},'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(root))
with zipfile.ZipFile(${JSON.stringify(archive)}) as z:
 print('Verified archive entries:')
 for n in z.namelist(): print(n)
 assert 'manifest.json' in z.namelist() and 'popup.html' in z.namelist()
`], { stdout: 'inherit', stderr: 'inherit' })
if (await zip.exited !== 0) process.exit(1)
await mkdir(resolve(root,'public'), { recursive:true })
await copyFile(archive,resolve(root,'public/weorex-capture.zip'))
console.log('Extension packaged in public/weorex-capture.zip')