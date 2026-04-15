/* tslint:disable */
/* eslint-disable */

export class LBM {
    free(): void;
    [Symbol.dispose](): void;
    build_solid(poly: Float32Array, poly_len: number): void;
    clear_diverged(): void;
    get_cols(): number;
    get_convergence_delta(): number;
    get_curl_max(): number;
    get_curl_min(): number;
    get_curl_ptr(): number;
    get_diverged(): boolean;
    get_n(): number;
    get_overflow_count(): number;
    get_rho_max(): number;
    get_rho_min(): number;
    get_rho_ptr(): number;
    get_rows(): number;
    get_solid_ptr(): number;
    get_spd_max(): number;
    get_spd_min(): number;
    get_spd_ptr(): number;
    get_ux_ptr(): number;
    get_uy_ptr(): number;
    constructor(cols: number, rows: number);
    set_nu(nu: number): void;
    step(in_u: number, turb: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_lbm_free: (a: number, b: number) => void;
    readonly lbm_build_solid: (a: number, b: number, c: number, d: number) => void;
    readonly lbm_clear_diverged: (a: number) => void;
    readonly lbm_get_cols: (a: number) => number;
    readonly lbm_get_convergence_delta: (a: number) => number;
    readonly lbm_get_curl_max: (a: number) => number;
    readonly lbm_get_curl_min: (a: number) => number;
    readonly lbm_get_curl_ptr: (a: number) => number;
    readonly lbm_get_diverged: (a: number) => number;
    readonly lbm_get_n: (a: number) => number;
    readonly lbm_get_overflow_count: (a: number) => number;
    readonly lbm_get_rho_max: (a: number) => number;
    readonly lbm_get_rho_min: (a: number) => number;
    readonly lbm_get_rho_ptr: (a: number) => number;
    readonly lbm_get_rows: (a: number) => number;
    readonly lbm_get_solid_ptr: (a: number) => number;
    readonly lbm_get_spd_max: (a: number) => number;
    readonly lbm_get_spd_min: (a: number) => number;
    readonly lbm_get_spd_ptr: (a: number) => number;
    readonly lbm_get_ux_ptr: (a: number) => number;
    readonly lbm_get_uy_ptr: (a: number) => number;
    readonly lbm_new: (a: number, b: number) => number;
    readonly lbm_set_nu: (a: number, b: number) => void;
    readonly lbm_step: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
