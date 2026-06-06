import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { globby } from 'globby'
import { parse as parseYaml } from 'yaml'
import { categories } from './categories.ts'
import { packagesDir, distFile, rootDir } from './utils.ts'
import type { BuildOutput, PackageInfo } from './types.ts'

export async function build(): Promise<void> {
  const files = await globby('*.yml', { cwd: packagesDir })
  const packages: PackageInfo[] = []

  for (const file of files) {
    const name = basename(file, '.yml')
    const raw = await readFile(`${packagesDir}/${file}`, 'utf-8')
    const pkg = parseYaml(raw) as PackageInfo

    if (pkg.name !== name) {
      throw new Error(
        `Filename "${file}" does not match package name "${pkg.name}"`,
      )
    }
    if (!categories.includes(pkg.category)) {
      throw new Error(
        `Invalid category "${pkg.category}" in ${file}. Allowed: ${categories.join(', ')}`,
      )
    }
    if (!pkg.compatibility?.adonis || Object.keys(pkg.compatibility.adonis).length === 0) {
      throw new Error(`Missing compatibility.adonis in ${file}`)
    }

    packages.push(pkg)
  }

  packages.sort((a, b) => a.name.localeCompare(b.name))

  const pkgJsonRaw = await readFile(`${rootDir}/package.json`, 'utf-8')
  const pkgJson = JSON.parse(pkgJsonRaw) as { version: string }

  const output: BuildOutput = {
    generatedAt: new Date().toISOString(),
    version: pkgJson.version,
    categories,
    packages,
  }

  await writeFile(distFile, `${JSON.stringify(output, null, 2)}\n`, 'utf-8')
}
