import {AsyncResourceProvider} from "./asyncMultiResourceLoader";
import {GlCtx} from "../typeSafety/aliases";
import {assertThere} from "../typeSafety/optionals";

/**
 * @desc A factory for a new async texture loader for use in an AsyncMultiResourceLoader.
 * @param source: The source URI of the texture to be loaded.
 * @param fallback_provider: An optional provider for a fallback. If provided, the return of the fallback provider will be
 * provided if the texture fails to load. If no fallback provider exists, a fatal error will be raised if the texture fails to load.
 */
export function makeTextureLoader(source: string, fallback_provider: (() => HTMLImageElement) | null = null): AsyncResourceProvider<HTMLImageElement> {
    return (finished, fatal) => {
        const image = new Image();
        image.src = source;
        image.addEventListener("load", () => {
            finished(image);
        });
        image.addEventListener("error", () => {
            if (fallback_provider != null) {
                finished(fallback_provider());
            } else {
                fatal(new Error("Failed to load required resource."));
            }
        });

        return null;
    };
}

type FormatTypeMapping = {
    RGBA: "UNSIGNED_BYTE" | "UNSIGNED_SHORT_4_4_4_4" | "UNSIGNED_SHORT_5_5_5_1",
    RGB: "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_6_5",
    LUMINANCE_ALPHA: "UNSIGNED_BYTE",
    LUMINANCE: "UNSIGNED_BYTE",
    ALPHA: "UNSIGNED_BYTE"
}
export function makeGlTexture<TFormat extends keyof FormatTypeMapping>(
        gl: GlCtx, unit: number,
        image: {
            provider: ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
            format: TFormat,
            type: FormatTypeMapping[TFormat]
        },
        parameters: Partial<{
            TEXTURE_MIN_FILTER: "LINEAR" | "NEAREST" | "NEAREST_MIPMAP_NEAREST" | "LINEAR_MIPMAP_NEAREST" | "NEAREST_MIPMAP_LINEAR" | "LINEAR_MIPMAP_LINEAR",
            TEXTURE_MAG_FILTER: "LINEAR" | "NEAREST",
            TEXTURE_WRAP_S: "REPEAT" | "CLAMP_TO_EDGE" | "MIRRORED_REPEAT",
            TEXTURE_WRAP_T: "REPEAT" | "CLAMP_TO_EDGE" | "MIRRORED_REPEAT"
        }>) {
    const texture = assertThere(gl.createTexture());
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const format = gl[image.format];
    gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl[image.type], image.provider);

    function tryApplyParam(param: keyof typeof parameters) {
        const value = parameters[param];
        if (value != null) gl.texParameteri(gl.TEXTURE_2D, gl[param], gl[value]);
    }
    tryApplyParam("TEXTURE_MIN_FILTER");
    tryApplyParam("TEXTURE_MAG_FILTER");
    tryApplyParam("TEXTURE_WRAP_S");
    tryApplyParam("TEXTURE_WRAP_T");

    return texture;
}