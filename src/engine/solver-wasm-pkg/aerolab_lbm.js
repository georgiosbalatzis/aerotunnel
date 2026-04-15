/* @ts-self-types="./aerolab_lbm.d.ts" */

export class LBM {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LBMFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_lbm_free(ptr, 0);
    }
    /**
     * @param {Float32Array} poly
     * @param {number} poly_len
     */
    build_solid(poly, poly_len) {
        const ptr0 = passArrayF32ToWasm0(poly, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.lbm_build_solid(this.__wbg_ptr, ptr0, len0, poly_len);
    }
    clear_diverged() {
        wasm.lbm_clear_diverged(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    get_cols() {
        const ret = wasm.lbm_get_cols(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_convergence_delta() {
        const ret = wasm.lbm_get_convergence_delta(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_curl_max() {
        const ret = wasm.lbm_get_curl_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_curl_min() {
        const ret = wasm.lbm_get_curl_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_curl_ptr() {
        const ret = wasm.lbm_get_curl_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    get_diverged() {
        const ret = wasm.lbm_get_diverged(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get_n() {
        const ret = wasm.lbm_get_n(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_overflow_count() {
        const ret = wasm.lbm_get_overflow_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_rho_max() {
        const ret = wasm.lbm_get_rho_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_rho_min() {
        const ret = wasm.lbm_get_rho_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_rho_ptr() {
        const ret = wasm.lbm_get_rho_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_rows() {
        const ret = wasm.lbm_get_rows(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_solid_ptr() {
        const ret = wasm.lbm_get_solid_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_spd_max() {
        const ret = wasm.lbm_get_spd_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_spd_min() {
        const ret = wasm.lbm_get_spd_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_spd_ptr() {
        const ret = wasm.lbm_get_spd_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_ux_ptr() {
        const ret = wasm.lbm_get_ux_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_uy_ptr() {
        const ret = wasm.lbm_get_uy_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} cols
     * @param {number} rows
     */
    constructor(cols, rows) {
        const ret = wasm.lbm_new(cols, rows);
        this.__wbg_ptr = ret >>> 0;
        LBMFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} nu
     */
    set_nu(nu) {
        wasm.lbm_set_nu(this.__wbg_ptr, nu);
    }
    /**
     * @param {number} in_u
     * @param {number} turb
     */
    step(in_u, turb) {
        wasm.lbm_step(this.__wbg_ptr, in_u, turb);
    }
}
if (Symbol.dispose) LBM.prototype[Symbol.dispose] = LBM.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6b64449b9b9ed33c: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_random_0eb970c322365506: function() {
            const ret = Math.random();
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./aerolab_lbm_bg.js": import0,
    };
}

const LBMFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lbm_free(ptr >>> 0, 1));

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('aerolab_lbm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
