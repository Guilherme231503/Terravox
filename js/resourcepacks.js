// Terravox - gerador de resource packs: navegador de texturas, filtros em lote, editor de pixels e exemplos.
"use strict";

(() => {
    const $ = (id) => document.getElementById(id);
    const TEXTURES = window.TERRAVOX_TEXTURES || [];

    // Texturas em cinza que o jogo multiplica por uma cor ao carregar (game/Resources.cpp, tintFor)
    const TINTED = /\/(grass_block_top|short_grass|oak_leaves|birch_leaves|spruce_leaves|jungle_leaves|acacia_leaves|dark_oak_leaves|lily_pad|water_still)\.png$/;

    const CATEGORIES = [
        ["all", "Todas"],
        ["textures/block/", "Blocos"],
        ["textures/item/", "Itens"],
        ["textures/entity/", "Entidades"],
        ["textures/models/armor/", "Armaduras"],
        ["textures/particle/", "Partículas"],
        ["textures/environment/", "Céu e ambiente"],
        ["textures/gui/", "Interface"],
    ];

    // ---------- Estado de cada textura
    const items = TEXTURES.map((t) => ({
        path: t.path,
        name: t.path.split("/").pop().replace(/\.png$/, ""),
        src: t.data,
        original: null, // canvas
        current: null,  // canvas modificado (ou null)
        selected: false,
        el: null,
        thumb: null,
    }));

    function loadImages() {
        return Promise.all(items.map((it) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.width;
                c.height = img.height;
                c.getContext("2d").drawImage(img, 0, 0);
                it.original = c;
                resolve();
            };
            img.onerror = resolve;
            img.src = it.src;
        })));
    }

    const cloneCanvas = (src, w = src.width, h = src.height) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(src, 0, 0, w, h);
        return c;
    };
    const image = (it) => it.current || it.original;

    // ---------- Grade de texturas
    const grid = $("grid");
    function buildGrid() {
        const frag = document.createDocumentFragment();
        for (const it of items) {
            if (!it.original) continue;
            const b = document.createElement("div");
            b.className = "tex";
            b.tabIndex = 0;
            b.setAttribute("role", "button");
            b.title = it.path;
            const thumb = document.createElement("canvas");
            const dot = document.createElement("i");
            dot.className = "dot";
            dot.title = "Modificada";
            const label = document.createElement("span");
            label.textContent = it.name;
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.setAttribute("aria-label", "Selecionar " + it.name);
            chk.style.cssText = "position:absolute;top:4px;left:4px;width:16px;height:16px;accent-color:#f2c14e;cursor:pointer";
            chk.addEventListener("click", (e) => { e.stopPropagation(); setSelected(it, chk.checked); });
            b.append(chk, dot, thumb, label);
            b.addEventListener("click", () => openEditor(it));
            b.addEventListener("keydown", (e) => {
                if (e.key === "Enter") openEditor(it);
                if (e.key === " ") { e.preventDefault(); setSelected(it, !it.selected); }
            });
            it.el = b;
            it.thumb = thumb;
            it.chk = chk;
            drawThumb(it);
            frag.appendChild(b);
        }
        grid.appendChild(frag);
    }

    function drawThumb(it) {
        const src = image(it);
        // Animacoes (tiras verticais) e texturas nao quadradas: mostra o primeiro quadro / a imagem inteira
        const frame = src.height > src.width && src.height % src.width === 0 ? src.width : src.height;
        it.thumb.width = src.width;
        it.thumb.height = frame;
        const g = it.thumb.getContext("2d");
        g.clearRect(0, 0, src.width, frame);
        g.drawImage(src, 0, 0);
        it.el.classList.toggle("mod", !!it.current);
    }

    function setSelected(it, v) {
        it.selected = v;
        it.chk.checked = v;
        it.el.classList.toggle("sel", v);
        updateStats();
    }

    function visibleItems() {
        const cat = $("category").value;
        const q = $("search").value.trim().toLowerCase();
        const onlyMod = $("onlyModified").checked;
        return items.filter((it) => it.original &&
            (cat === "all" || it.path.startsWith(cat)) &&
            (!q || it.path.toLowerCase().includes(q)) &&
            (!onlyMod || it.current));
    }

    function applyFilterView() {
        const vis = new Set(visibleItems());
        for (const it of items) if (it.el) it.el.hidden = !vis.has(it);
        updateStats();
    }

    function updateStats() {
        const vis = visibleItems().length;
        const sel = items.filter((i) => i.selected).length;
        const mod = items.filter((i) => i.current).length;
        $("stats").textContent = `${vis} texturas mostradas · ${sel} selecionadas · ${mod} modificadas (vão para o pack)`;
        $("download").disabled = mod === 0;
        $("applyTarget").options[0].textContent = `Selecionadas (${sel})`;
        $("applyTarget").options[1].textContent = `Todas as mostradas (${vis})`;
    }

    // ---------- Filtros em lote
    function rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }
    function hslToRgb(h, s, l) {
        if (s === 0) return [l, l, l];
        const hue = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
    }

    function readFilter() {
        return {
            hue: Number($("fHue").value),
            saturation: Number($("fSat").value),
            brightness: Number($("fBright").value),
            contrast: Number($("fContrast").value),
            noise: Number($("fNoise").value),
            colorize: $("fColorize").value,
            colorizeAmount: Number($("fColorizeAmount").value),
            invert: $("fInvert").checked,
        };
    }

    function filterCanvas(src, f) {
        const c = cloneCanvas(src);
        const g = c.getContext("2d");
        const d = g.getImageData(0, 0, c.width, c.height);
        const p = d.data;
        const cz = parseInt(f.colorize.slice(1), 16);
        const czRgb = [((cz >> 16) & 255) / 255, ((cz >> 8) & 255) / 255, (cz & 255) / 255];
        // ruido deterministico (mesmo resultado a cada aplicacao)
        let seed = 1234567;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
        for (let i = 0; i < p.length; i += 4) {
            if (p[i + 3] === 0) continue;
            let r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
            if (f.invert) { r = 1 - r; gg = 1 - gg; b = 1 - b; }
            if (f.hue || f.saturation !== 1) {
                let [h, s, l] = rgbToHsl(r, gg, b);
                h = (h + f.hue / 360 + 1) % 1;
                s = Math.min(1, s * f.saturation);
                [r, gg, b] = hslToRgb(h, s, l);
            }
            if (f.colorizeAmount > 0) {
                const l = 0.299 * r + 0.587 * gg + 0.114 * b;
                r += (l * czRgb[0] * 1.4 - r) * f.colorizeAmount;
                gg += (l * czRgb[1] * 1.4 - gg) * f.colorizeAmount;
                b += (l * czRgb[2] * 1.4 - b) * f.colorizeAmount;
            }
            const k = f.brightness / 100;
            r = (r - 0.5) * f.contrast + 0.5 + k;
            gg = (gg - 0.5) * f.contrast + 0.5 + k;
            b = (b - 0.5) * f.contrast + 0.5 + k;
            if (f.noise > 0) {
                const n = (rnd() - 0.5) * f.noise / 100;
                r += n; gg += n; b += n;
            }
            p[i] = Math.max(0, Math.min(255, r * 255 + 0.5));
            p[i + 1] = Math.max(0, Math.min(255, gg * 255 + 0.5));
            p[i + 2] = Math.max(0, Math.min(255, b * 255 + 0.5));
        }
        g.putImageData(d, 0, 0);
        return c;
    }

    function targets() {
        return $("applyTarget").value === "selected" ? items.filter((i) => i.selected && i.original) : visibleItems();
    }

    function applyFilterTo(list, f) {
        for (const it of list) {
            it.current = filterCanvas(image(it), f);
            drawThumb(it);
        }
        updateStats();
    }

    function resetFilterInputs() {
        $("fHue").value = 0; $("fSat").value = 1; $("fBright").value = 0; $("fContrast").value = 1;
        $("fNoise").value = 0; $("fColorizeAmount").value = 0; $("fInvert").checked = false;
        showFilterOutputs();
    }
    function showFilterOutputs() {
        $("oHue").textContent = $("fHue").value + "°";
        $("oSat").textContent = Number($("fSat").value).toFixed(2);
        $("oBright").textContent = $("fBright").value;
        $("oContrast").textContent = Number($("fContrast").value).toFixed(2);
        $("oNoise").textContent = $("fNoise").value;
        $("oColorize").textContent = Math.round($("fColorizeAmount").value * 100) + "%";
    }

    // ---------- Exemplos prontos
    const EXAMPLES = {
        madeira: {
            name: "Madeira-Escura", description: "Madeiras mais escuras e avermelhadas, com mais contraste.",
            steps: [{ match: /^textures\/block\/.*(_planks|_log|_log_top|stripped_|crafting_table|bookshelf|oak_door|ladder|barrel|composter)/, filter: { hue: -8, saturation: 1.15, brightness: -12, contrast: 1.12 } }],
        },
        pastel: {
            name: "Pastel", description: "Blocos e itens em tons suaves e claros.",
            steps: [{ match: /^textures\/(block|item)\//, filter: { saturation: 0.55, brightness: 10, contrast: 0.85 } }],
        },
        noturno: {
            name: "Noite Neon", description: "Minérios e luzes em neon, pedras escuras.",
            steps: [
                { match: /^textures\/block\/(stone|cobblestone|deepslate|andesite|diorite|granite|gravel|dirt)/, filter: { brightness: -18, saturation: 0.6, contrast: 1.1 } },
                { match: /_ore\.png$|glowstone|torch|lantern|redstone|lava/, filter: { saturation: 1.9, brightness: 8, contrast: 1.2 } },
            ],
        },
        retro: {
            name: "Retro-PB", description: "Tudo em preto e branco com mais contraste.",
            steps: [{ match: /^textures\//, filter: { saturation: 0, contrast: 1.2 } }],
        },
    };

    function applyExample(key) {
        const ex = EXAMPLES[key];
        for (const it of items) it.current = null;
        const base = { hue: 0, saturation: 1, brightness: 0, contrast: 1, noise: 0, colorize: "#ffffff", colorizeAmount: 0, invert: false };
        for (const step of ex.steps) {
            const list = items.filter((it) => it.original && step.match.test(it.path));
            for (const it of list) it.current = filterCanvas(image(it), { ...base, ...step.filter });
        }
        items.forEach((it) => it.el && drawThumb(it));
        $("packName").value = ex.name;
        $("packDesc").value = ex.description;
        updateStats();
        Terravox.toast(`Exemplo "${ex.name}" aplicado: ${items.filter((i) => i.current).length} texturas.`);
    }

    // ---------- Editor de pixels
    const dlg = $("editor");
    const ed = { item: null, canvas: $("edCanvas"), ctx: null, tool: "pencil", color: "#ffffff", undo: [], redo: [], drawing: false, scale: 1 };
    ed.ctx = ed.canvas.getContext("2d", { willReadFrequently: true });

    function openEditor(it) {
        ed.item = it;
        ed.undo = [];
        ed.redo = [];
        loadIntoEditor(image(it));
        $("edTitle").textContent = it.path;
        $("edTint").hidden = !TINTED.test(it.path);
        const anim = image(it).height > image(it).width && image(it).height % image(it).width === 0;
        $("edAnim").hidden = !anim;
        dlg.showModal();
    }

    function loadIntoEditor(src) {
        ed.canvas.width = src.width;
        ed.canvas.height = src.height;
        ed.ctx.clearRect(0, 0, src.width, src.height);
        ed.ctx.drawImage(src, 0, 0);
        fitEditor();
        buildPalette();
        $("edSize").textContent = `${src.width}×${src.height} px`;
    }

    function fitEditor() {
        const maxW = Math.min(560, window.innerWidth - 80), maxH = Math.max(260, window.innerHeight * 0.62);
        ed.scale = Math.max(1, Math.floor(Math.min(maxW / ed.canvas.width, maxH / Math.min(ed.canvas.height, ed.canvas.width * 2))));
        ed.canvas.style.width = ed.canvas.width * ed.scale + "px";
        ed.canvas.style.height = ed.canvas.height * ed.scale + "px";
    }

    function snapshot() {
        ed.undo.push(ed.ctx.getImageData(0, 0, ed.canvas.width, ed.canvas.height));
        if (ed.undo.length > 60) ed.undo.shift();
        ed.redo = [];
    }
    function restore(stackFrom, stackTo) {
        const d = stackFrom.pop();
        if (!d) return;
        stackTo.push(ed.ctx.getImageData(0, 0, ed.canvas.width, ed.canvas.height));
        if (d.width !== ed.canvas.width || d.height !== ed.canvas.height) {
            ed.canvas.width = d.width;
            ed.canvas.height = d.height;
            fitEditor();
            $("edSize").textContent = `${d.width}×${d.height} px`;
        }
        ed.ctx.putImageData(d, 0, 0);
    }

    function buildPalette() {
        const d = ed.ctx.getImageData(0, 0, ed.canvas.width, ed.canvas.height).data;
        const count = new Map();
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) continue;
            const hex = "#" + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
            count.set(hex, (count.get(hex) || 0) + 1);
        }
        const colors = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map((e) => e[0]);
        for (const c of ["#000000", "#ffffff", "#e0533d", "#f2c14e", "#5fae3c", "#3d8bd9", "#9b59b6", "#8a5a35"])
            if (colors.length < 32 && !colors.includes(c)) colors.push(c);
        const pal = $("edPalette");
        pal.textContent = "";
        for (const c of colors) {
            const b = document.createElement("button");
            b.type = "button";
            b.style.background = c;
            b.title = c;
            b.setAttribute("aria-label", "Cor " + c);
            b.onclick = () => setColor(c);
            pal.appendChild(b);
        }
    }

    function setColor(c) {
        ed.color = c;
        $("edColor").value = c;
    }

    function setTool(t) {
        ed.tool = t;
        document.querySelectorAll("#edTools button[data-tool]").forEach((b) => {
            b.classList.toggle("active", b.dataset.tool === t);
            b.setAttribute("aria-pressed", b.dataset.tool === t);
        });
    }

    function pixelAt(e) {
        const r = ed.canvas.getBoundingClientRect();
        return [Math.floor((e.clientX - r.left) / r.width * ed.canvas.width), Math.floor((e.clientY - r.top) / r.height * ed.canvas.height)];
    }

    function plot(x, y) {
        if (x < 0 || y < 0 || x >= ed.canvas.width || y >= ed.canvas.height) return;
        if (ed.tool === "eraser") ed.ctx.clearRect(x, y, 1, 1);
        else {
            ed.ctx.fillStyle = ed.color;
            ed.ctx.clearRect(x, y, 1, 1);
            ed.ctx.fillRect(x, y, 1, 1);
        }
    }

    function line(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            plot(x0, y0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }

    function fill(x, y) {
        const w = ed.canvas.width, h = ed.canvas.height;
        const img = ed.ctx.getImageData(0, 0, w, h), p = img.data;
        const at = (i) => (p[i] << 24 | p[i + 1] << 16 | p[i + 2] << 8 | p[i + 3]) >>> 0;
        const target = at((y * w + x) * 4);
        const n = parseInt(ed.color.slice(1), 16);
        const rgba = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
        if (target === ((rgba[0] << 24 | rgba[1] << 16 | rgba[2] << 8 | 255) >>> 0)) return;
        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
            const i = (cy * w + cx) * 4;
            if (at(i) !== target) continue;
            p[i] = rgba[0]; p[i + 1] = rgba[1]; p[i + 2] = rgba[2]; p[i + 3] = 255;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        ed.ctx.putImageData(img, 0, 0);
    }

    function pick(x, y) {
        const d = ed.ctx.getImageData(x, y, 1, 1).data;
        if (d[3] === 0) return;
        setColor("#" + ((1 << 24) | (d[0] << 16) | (d[1] << 8) | d[2]).toString(16).slice(1));
        setTool("pencil");
    }

    let last = null;
    ed.canvas.addEventListener("pointerdown", (e) => {
        const [x, y] = pixelAt(e);
        if (ed.tool === "picker" || e.altKey) return pick(x, y);
        snapshot();
        if (ed.tool === "fill") return fill(x, y);
        ed.drawing = true;
        ed.canvas.setPointerCapture(e.pointerId);
        plot(x, y);
        last = [x, y];
    });
    ed.canvas.addEventListener("pointermove", (e) => {
        if (!ed.drawing) return;
        const [x, y] = pixelAt(e);
        line(last[0], last[1], x, y);
        last = [x, y];
    });
    ed.canvas.addEventListener("pointerup", () => (ed.drawing = false));
    ed.canvas.addEventListener("pointercancel", () => (ed.drawing = false));

    function setupEditor() {
        $("edTools").addEventListener("click", (e) => {
            const b = e.target.closest("button[data-tool]");
            if (b) setTool(b.dataset.tool);
        });
        $("edColor").addEventListener("input", (e) => (ed.color = e.target.value));
        $("edUndo").onclick = () => restore(ed.undo, ed.redo);
        $("edRedo").onclick = () => restore(ed.redo, ed.undo);
        $("edReset").onclick = () => { snapshot(); loadIntoEditor(ed.item.original); };
        $("edDouble").onclick = () => {
            if (ed.canvas.width >= 512) return Terravox.toast("Já está grande o bastante (512 px).");
            snapshot();
            const c = cloneCanvas(ed.canvas, ed.canvas.width * 2, ed.canvas.height * 2);
            loadIntoEditor(c);
        };
        $("edFlip").onclick = () => {
            snapshot();
            const c = cloneCanvas(ed.canvas);
            ed.ctx.clearRect(0, 0, c.width, c.height);
            ed.ctx.save();
            ed.ctx.scale(-1, 1);
            ed.ctx.drawImage(c, -c.width, 0);
            ed.ctx.restore();
        };
        $("edUpload").addEventListener("change", (e) => {
            const file = e.target.files[0];
            e.target.value = "";
            if (!file) return;
            const img = new Image();
            img.onload = () => { snapshot(); loadIntoEditor(img); URL.revokeObjectURL(img.src); };
            img.onerror = () => Terravox.toast("Não consegui abrir essa imagem.");
            img.src = URL.createObjectURL(file);
        });
        $("edPng").onclick = () => Terravox.download(new Blob([Terravox.canvasToBytes(ed.canvas)], { type: "image/png" }), ed.item.name + ".png");
        $("edSave").onclick = () => {
            const it = ed.item;
            const same = (() => {
                const o = it.original;
                if (o.width !== ed.canvas.width || o.height !== ed.canvas.height) return false;
                const a = o.getContext("2d").getImageData(0, 0, o.width, o.height).data;
                const b = ed.ctx.getImageData(0, 0, o.width, o.height).data;
                for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
                return true;
            })();
            it.current = same ? null : cloneCanvas(ed.canvas);
            drawThumb(it);
            updateStats();
            dlg.close();
        };
        $("edCancel").onclick = () => dlg.close();
        dlg.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); restore(ed.undo, ed.redo); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); restore(ed.redo, ed.undo); }
            const keys = { b: "pencil", e: "eraser", g: "fill", i: "picker" };
            if (!e.ctrlKey && keys[e.key] && e.target.tagName !== "INPUT") setTool(keys[e.key]);
        });
        window.addEventListener("resize", () => dlg.open && fitEditor());
    }

    // ---------- Download do pack
    function downloadPack() {
        const mod = items.filter((i) => i.current);
        if (!mod.length) return;
        const dir = Terravox.folderName($("packName").value, "Meu-Pack");
        const desc = $("packDesc").value.replace(/\r?\n/g, " ").trim() || dir;
        const files = [{
            name: dir + "/pack.txt",
            data: desc + "\nFeito no Gerador de Resource Packs do Terravox. Instale em net/vexill/vage/terravox/resourcepacks/.\n",
        }];
        for (const it of mod) files.push({ name: dir + "/" + it.path, data: Terravox.canvasToBytes(it.current) });
        Terravox.download(Terravox.makeZip(files), dir + ".zip");
        Terravox.toast(`Pack "${dir}" baixado com ${mod.length} texturas.`);
    }

    // ---------- Inicio
    async function init() {
        const cat = $("category");
        for (const [v, label] of CATEGORIES) cat.add(new Option(label, v));
        cat.value = "textures/block/";
        $("loading").hidden = false;
        await loadImages();
        $("loading").hidden = true;
        buildGrid();
        applyFilterView();
        setupEditor();
        setTool("pencil");
        resetFilterInputs();

        cat.addEventListener("change", applyFilterView);
        $("search").addEventListener("input", applyFilterView);
        $("onlyModified").addEventListener("change", applyFilterView);
        $("selectAll").onclick = () => visibleItems().forEach((it) => setSelected(it, true));
        $("selectNone").onclick = () => items.forEach((it) => it.el && setSelected(it, false));
        $("filters").addEventListener("input", showFilterOutputs);
        $("applyFilter").onclick = () => {
            const list = targets();
            if (!list.length) return Terravox.toast("Nenhuma textura para aplicar (selecione algumas ou mude o filtro).");
            applyFilterTo(list, readFilter());
            Terravox.toast(`Filtro aplicado em ${list.length} texturas.`);
        };
        $("resetFilter").onclick = resetFilterInputs;
        $("revert").onclick = () => {
            const list = targets();
            list.forEach((it) => { it.current = null; drawThumb(it); });
            updateStats();
            Terravox.toast(`${list.length} texturas voltaram ao original.`);
        };
        document.querySelectorAll("[data-example]").forEach((b) => (b.onclick = () => applyExample(b.dataset.example)));
        $("download").onclick = downloadPack;
        $("packName").addEventListener("input", () => ($("installName").textContent = Terravox.folderName($("packName").value, "Meu-Pack")));
    }

    init();
})();
