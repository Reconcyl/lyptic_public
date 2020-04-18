function* realRange(a: number, b: number) {
    for (; a <= b; a++) {
        yield a;
    }
}

export function range(a: number, b: number) {
    if (b < a) {
        return realRange(b, a);
    } else {
        return realRange(a, b);
    }
}

export function mod(n: number, d: number) {
    return (n % d + d) % d;
}

export function zero_at_edges(x: number) {
    function smoothstep(x: number) {
        x = Math.max(0, Math.min(1, x));
        return 3 * x * x - 2 * x * x * x;
    }
    const SHARPNESS = 5;
    return smoothstep(SHARPNESS * x) * smoothstep(SHARPNESS * (1 - x));
}