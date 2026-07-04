/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert'
import * as path from 'path'
import semver from 'semver'
import packageJson from '../../package.json'
import { fs } from 'aws-core-vscode/shared'

/**
 * Validate the setup of the project itself.
 */

describe('package validations', function () {
    /**
     * Type checking depends on icon entries in core/package.json.
     * To ensure that the extension has the the typed icons available, they must be synced
     * to the local package.json. This test ensures that any hand modifications to individual
     * package.jsons are detected.
     *
     * See icons.md for more info.
     */
    it('has synced contributes.icons with core/package.json', async function () {
        const corePackageJson = JSON.parse(
            await fs.readFileText(path.resolve(__dirname, '../../../../core/package.json'))
        )
        assert.deepStrictEqual(packageJson.contributes.icons, corePackageJson.contributes.icons)
    })

    /**
     * Guards the dependency versions bumped at the root package.json (build tooling
     * such as webpack/eslint/vsce/test-electron/test-web, and the
     * @aws/language-server-runtimes runtime dependency). This catches accidental
     * reverts/downgrades and malformed semver ranges.
     */
    describe('root package.json upgraded dependency versions', function () {
        let rootPackageJson: { devDependencies: Record<string, string>; dependencies: Record<string, string> }

        before(async function () {
            rootPackageJson = JSON.parse(await fs.readFileText(path.resolve(__dirname, '../../../../package.json')))
        })

        // name -> [previous version (exclusive lower bound), new minimum version]
        const upgradedDevDependencies: Record<string, [string, string]> = {
            '@vscode/test-electron': ['2.3.8', '2.4.0'],
            '@vscode/test-web': ['0.0.65', '0.0.67'],
            '@vscode/vsce': ['2.19.0', '3.1.0'],
            eslint: ['8.56.0', '9.0.0'],
            webpack: ['5.95.0', '5.104.0'],
        }

        const upgradedDependencies: Record<string, [string, string]> = {
            '@aws/language-server-runtimes': ['0.3.5', '0.3.10'],
        }

        it('declares valid semver ranges for the upgraded devDependencies', function () {
            for (const name of Object.keys(upgradedDevDependencies)) {
                const range = rootPackageJson.devDependencies[name]
                assert.ok(range, `expected root devDependencies to declare "${name}"`)
                assert.ok(semver.validRange(range), `"${name}" has an invalid semver range: "${range}"`)
            }
        })

        it('declares valid semver ranges for the upgraded dependencies', function () {
            for (const name of Object.keys(upgradedDependencies)) {
                const range = rootPackageJson.dependencies[name]
                assert.ok(range, `expected root dependencies to declare "${name}"`)
                assert.ok(semver.validRange(range), `"${name}" has an invalid semver range: "${range}"`)
            }
        })

        it('bumps devDependencies to at least their new expected minimum versions', function () {
            for (const [name, [, newMinimum]] of Object.entries(upgradedDevDependencies)) {
                const range = rootPackageJson.devDependencies[name]
                const minVersion = semver.minVersion(range)
                assert.ok(minVersion, `could not determine a minimum version for "${name}" range "${range}"`)
                assert.ok(
                    semver.gte(minVersion, newMinimum),
                    `expected "${name}" range "${range}" to resolve to at least "${newMinimum}"`
                )
            }
        })

        it('bumps dependencies to at least their new expected minimum versions', function () {
            for (const [name, [, newMinimum]] of Object.entries(upgradedDependencies)) {
                const range = rootPackageJson.dependencies[name]
                const minVersion = semver.minVersion(range)
                assert.ok(minVersion, `could not determine a minimum version for "${name}" range "${range}"`)
                assert.ok(
                    semver.gte(minVersion, newMinimum),
                    `expected "${name}" range "${range}" to resolve to at least "${newMinimum}"`
                )
            }
        })

        it('does not regress the upgraded devDependencies below their prior versions', function () {
            for (const [name, [priorVersion]] of Object.entries(upgradedDevDependencies)) {
                const range = rootPackageJson.devDependencies[name]
                const minVersion = semver.minVersion(range)
                assert.ok(minVersion, `could not determine a minimum version for "${name}" range "${range}"`)
                assert.ok(
                    semver.gt(minVersion, priorVersion),
                    `expected "${name}" range "${range}" to be greater than prior version "${priorVersion}"`
                )
            }
        })

        it('does not regress the upgraded dependencies below their prior versions', function () {
            for (const [name, [priorVersion]] of Object.entries(upgradedDependencies)) {
                const range = rootPackageJson.dependencies[name]
                const minVersion = semver.minVersion(range)
                assert.ok(minVersion, `could not determine a minimum version for "${name}" range "${range}"`)
                assert.ok(
                    semver.gt(minVersion, priorVersion),
                    `expected "${name}" range "${range}" to be greater than prior version "${priorVersion}"`
                )
            }
        })

        it('uses caret ranges for the upgraded dependencies, consistent with the rest of the manifest', function () {
            for (const name of [...Object.keys(upgradedDevDependencies), ...Object.keys(upgradedDependencies)]) {
                const range = rootPackageJson.devDependencies[name] ?? rootPackageJson.dependencies[name]
                assert.ok(range.startsWith('^'), `expected "${name}" ("${range}") to use a caret range`)
            }
        })

        it('leaves unrelated manifest entries untouched by the bump (negative case)', function () {
            // These entries appear alongside the bumped ones in package.json and must not be
            // accidentally modified by an unrelated dependency bump.
            assert.strictEqual(rootPackageJson.devDependencies['webpack-cli'], '^5.1.4')
            assert.strictEqual(rootPackageJson.devDependencies['typescript'], '^5.0.4')
            assert.strictEqual(rootPackageJson.dependencies['jaro-winkler'], '^0.2.8')
        })
    })
})
