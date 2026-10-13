// Terravox - gerador de shader packs.
// Gera block.frag / sky.frag (gradacao de cor + neblina) e terrain.vert (vento e ondas) a partir dos
// shaders originais do jogo (data/shaders.js). A previa aplica a mesma gradacao numa captura do jogo.
"use strict";

const ShaderGen = (() => {
    const DEFAULTS = {
        name: "Meu Shader",
        description: "Shader pack feito no gerador do site do Terravox.",
        exposure: 1, contrast: 1, saturation: 1, temperature: 0, gamma: 1,
        tint: "#ffffff", tintStrength: 0, mode: 0, posterize: 0,
        fog: 1, sky: true,
        leaves: 1, plants: 1, water: 1, speed: 1,
    };

    const PRESETS = {
        "Padrão": {},
        "Vibrante": { saturation: 1.35, temperature: 0.45, exposure: 1.02 },
        "Cinemático": { contrast: 1.18, saturation: 0.88, tint: "#bfe3ff", tintStrength: 0.18, exposure: 0.95, gamma: 1.06 },
        "Pôr do Sol Dourado": { temperature: 0.9, saturation: 1.12, exposure: 1.06, tint: "#ffcf8a", tintStrength: 0.2 },
        "Inverno Frio": { temperature: -0.8, saturation: 0.75, exposure: 1.05, fog: 0.7 },
        "Noir": { mode: 1, contrast: 1.35, exposure: 1.05 },
        "Sépia Antiga": { mode: 2, contrast: 1.08, gamma: 1.05, fog: 0.8 },
        "Retrô 8 bits": { posterize: 5, saturation: 1.25, contrast: 1.1 },
        "Neblina Densa": { fog: 0.4, saturation: 0.85, exposure: 0.97 },
        "Ventania": { leaves: 2.6, plants: 2.2, water: 2.2, speed: 1.7 },
    };

    const f = (v) => {
        const s = Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
        return s.includes(".") ? s : s + ".0";
    };

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
    }
    const toLinear = (c) => Math.pow(c, 2.2);

    // Multiplicador de cor final (temperatura + matiz), em espaco linear como no jogo.
    function tintVector(s) {
        const t = s.temperature;
        const temp = [1 + 0.12 * t, 1 + 0.015 * t, 1 - 0.14 * t];
        const rgb = hexToRgb(s.tint).map(toLinear);
        const m = Math.max(...rgb, 1e-4);
        const tint = rgb.map((c) => 1 + (c / m - 1) * s.tintStrength);
        return temp.map((c, i) => c * tint[i]);
    }

    function gradeGLSL(s) {
        const tv = tintVector(s);
        return `
// ---------------- Ajustes (gerados pelo site; pode editar e recarregar no jogo)
const float EXPOSURE = ${f(s.exposure)};   // brilho geral
const float CONTRAST = ${f(s.contrast)};   // 1 = original
const float SATURATION = ${f(s.saturation)}; // 0 = cinza, 1 = original
const vec3 TINT = vec3(${tv.map(f).join(", ")}); // temperatura + matiz
const float GAMMA = ${f(s.gamma)};      // > 1 escurece os tons medios
const int MODE = ${s.mode | 0};             // 0 normal, 1 preto e branco, 2 sepia
const float POSTERIZE = ${f(s.posterize)};  // 0 = desligado; N = niveis por canal

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 terravoxGrade(vec3 c) {
    c *= EXPOSURE;
    c = (c - 0.18) * CONTRAST + 0.18; // contraste em torno do cinza medio (espaco linear)
    c = mix(vec3(dot(c, LUMA)), max(c, 0.0), SATURATION);
    c *= TINT;
    if (MODE == 1) {
        c = vec3(dot(c, LUMA));
    } else if (MODE == 2) {
        float l = dot(c, LUMA);
        c = l * vec3(1.18, 0.92, 0.62);
    }
    c = max(c, 0.0);
    if (POSTERIZE > 0.5) { // niveis contados em espaco de tela (sRGB)
        vec3 g = pow(c, vec3(1.0 / 2.2));
        c = pow(floor(g * POSTERIZE + 0.5) / POSTERIZE, vec3(2.2));
    }
    return pow(c, vec3(GAMMA));
}
`;
    }

    function stripVersion(src) {
        return src.replace(/^\s*#version[^\n]*\n/, "");
    }

    // Envolve o main() original: roda o shader do jogo e aplica a gradacao no resultado.
    function wrapWithGrade(src, s, title, extraEdits) {
        let body = stripVersion(src);
        if (extraEdits) body = extraEdits(body);
        return `#version 450
// ${title} - ${s.name}
// Gerado pelo Gerador de Shaders do Terravox. O shader original do jogo roda inteiro
// (renomeado para terravoxBaseMain) e o resultado passa por terravoxGrade() no fim.
#define main terravoxBaseMain
${body.trimEnd()}
#undef main
${gradeGLSL(s)}
void main() {
    terravoxBaseMain();
    outColor.rgb = terravoxGrade(outColor.rgb);
}
`;
    }

    function blockFrag(src, s) {
        const warn = [];
        const out = wrapWithGrade(src, s, "block.frag (terreno e entidades)", (body) => {
            if (s.fog === 1) return body;
            const a = "float fogStart = g.fogColor.w;", b = "float fogEnd = g.skyColor.w;";
            if (!body.includes(a) || !body.includes(b)) {
                warn.push("Nao achei o calculo da neblina no block.frag; a distancia da neblina ficou a original.");
                return body;
            }
            return body
                .replace(a, `const float FOG_DISTANCE = ${f(s.fog)}; // < 1 = neblina mais perto\n    float fogStart = g.fogColor.w * FOG_DISTANCE * FOG_DISTANCE;`)
                .replace(b, "float fogEnd = g.skyColor.w * FOG_DISTANCE;");
        });
        return { out, warn };
    }

    const windChanged = (s) => s.leaves !== 1 || s.plants !== 1 || s.water !== 1 || s.speed !== 1;

    function terrainVert(src, s) {
        const t = "float t = g.cameraPos.w;";
        const pos = "gl_Position = g.viewProj * vec4(rel, 1.0);";
        if (!src.includes(t) || !src.includes(pos))
            return { out: null, warn: ["O terrain.vert do jogo mudou; o vento nao pode ser aplicado automaticamente."] };
        const out = src
            .replace(/^\s*#version[^\n]*\n/, `#version 450
// terrain.vert - ${s.name}
// Gerado pelo Gerador de Shaders do Terravox: vento nas folhas/plantas e ondas na agua.
const float WAVE_SPEED = ${f(s.speed)};  // velocidade do vento e das ondas
const float LEAVES_WAVE = ${f(s.leaves)}; // 0 = folhas paradas, 1 = original
const float PLANTS_WAVE = ${f(s.plants)}; // grama, flores, plantacoes
const float WATER_WAVE = ${f(s.water)};  // altura das ondas
`)
            .replace(t, "float t = g.cameraPos.w * WAVE_SPEED;")
            .replace(pos, `// Escala o deslocamento original de cada tipo de bloco
    vec3 still = local + pc.offset.xyz;
    float k = 1.0;
    if ((inData & WAVE_LEAVES) != 0u)
        k = LEAVES_WAVE;
    else if ((inData & WAVE_PLANT) != 0u)
        k = PLANTS_WAVE;
    else if ((inData & WAVE_WATER) != 0u) {
        k = WATER_WAVE;
        still.y -= 0.05; // a agua fica um pouco abaixo do bloco
    }
    rel = still + (rel - still) * k;

    ${pos}`);
        return { out, warn: [] };
    }

    // Retorna { files: {nome: texto}, warn: [] }
    function generate(settings, sources) {
        const s = { ...DEFAULTS, ...settings };
        const files = {}, warn = [];
        files["pack.txt"] = `${s.description.replace(/\r?\n/g, " ").trim() || s.name}
Gerado pelo Gerador de Shaders do Terravox. Instale em net/vexill/vage/terravox/shaders/ e ative em Opcoes > Shaders.
`;
        const bf = blockFrag(sources["block.frag"], s);
        files["block.frag"] = bf.out;
        warn.push(...bf.warn);
        if (s.sky)
            files["sky.frag"] = wrapWithGrade(sources["sky.frag"], s, "sky.frag (ceu, sol, lua e nuvens)");
        if (windChanged(s)) {
            const tv = terrainVert(sources["terrain.vert"], s);
            if (tv.out) files["terrain.vert"] = tv.out;
            warn.push(...tv.warn);
        }
        return { files, warn };
    }

    // ---------- Previa: mesma gradacao em JS (espaco linear), por pixel
    function makeGrader(settings) {
        const s = { ...DEFAULTS, ...settings };
        const tv = tintVector(s);
        const lin = new Float32Array(256);
        for (let i = 0; i < 256; i++) lin[i] = Math.pow(i / 255, 2.2);
        const L = [0.2126, 0.7152, 0.0722];
        const out = [0, 0, 0];
        return (r, g, b) => {
            let c = [lin[r] * s.exposure, lin[g] * s.exposure, lin[b] * s.exposure];
            for (let i = 0; i < 3; i++) c[i] = (c[i] - 0.18) * s.contrast + 0.18;
            let l = c[0] * L[0] + c[1] * L[1] + c[2] * L[2];
            for (let i = 0; i < 3; i++) c[i] = l + (Math.max(c[i], 0) - l) * s.saturation;
            for (let i = 0; i < 3; i++) c[i] *= tv[i];
            if (s.mode === 1) {
                l = c[0] * L[0] + c[1] * L[1] + c[2] * L[2];
                c = [l, l, l];
            } else if (s.mode === 2) {
                l = c[0] * L[0] + c[1] * L[1] + c[2] * L[2];
                c = [l * 1.18, l * 0.92, l * 0.62];
            }
            for (let i = 0; i < 3; i++) {
                let v = Math.max(c[i], 0);
                if (s.posterize > 0.5) v = Math.pow(Math.floor(Math.pow(v, 1 / 2.2) * s.posterize + 0.5) / s.posterize, 2.2);
                v = Math.pow(v, s.gamma);
                out[i] = Math.min(255, Math.pow(v, 1 / 2.2) * 255 + 0.5) | 0;
            }
            return out;
        };
    }

    return { DEFAULTS, PRESETS, generate, makeGrader, windChanged };
})();

if (typeof module !== "undefined") module.exports = ShaderGen;
