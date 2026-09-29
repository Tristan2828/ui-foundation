import type { Linter } from 'eslint'

export declare const PACKAGE_NAME: string
export declare const PRIMITIVES: string[]
export declare const TOKEN_SYNTAX_RULES: { selector: string; message: string }[]
export declare const NO_BARE_FETCH: { selector: string; message: string }
export declare function baseConfig(): Linter.Config
export declare function kebabCaseFilenames(files: string[], ignores?: string[]): Linter.Config

/** The lint config for an app built on the foundation. */
export default function uiFoundation(options?: { ignores?: string[] }): Linter.Config[]
