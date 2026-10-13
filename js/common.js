// Terravox - utilitarios do site: zip (sem compressao), downloads e avisos.
"use strict";

const Terravox = (() => {
    // ---------- CRC32 + ZIP "store" (o jogo le pastas; o zip so serve para baixar tudo de uma vez)
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    const enc = new TextEncoder();
    function toBytes(data) {
        if (data instanceof Uint8Array) return data;
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        return enc.encode(String(data));
    }

    // files: [{ name: "pasta/arquivo.txt", data: string | Uint8Array }]
    function makeZip(files) {
        const now = new Date();
        const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const chunks = [], central = [];
        let offset = 0;
        for (const f of files) {
            const name = enc.encode(f.name);
            const data = toBytes(f.data);
            const crc = crc32(data);
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true); // nomes em UTF-8
            local.setUint16(8, 0, true);      // sem compressao
            local.setUint16(10, time, true);
            local.setUint16(12, date, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, name.length, true);
            chunks.push(new Uint8Array(local.buffer), name, data);

            const cd = new DataView(new ArrayBuffer(46));
            cd.setUint32(0, 0x02014b50, true);
            cd.setUint16(4, 20, true);
            cd.setUint16(6, 20, true);
            cd.setUint16(8, 0x0800, true);
            cd.setUint16(12, time, true);
            cd.setUint16(14, date, true);
            cd.setUint32(16, crc, true);
            cd.setUint32(20, data.length, true);
            cd.setUint32(24, data.length, true);
            cd.setUint16(28, name.length, true);
            cd.setUint32(42, offset, true);
            central.push(new Uint8Array(cd.buffer), name);
            offset += 30 + name.length + data.length;
        }
        const cdSize = central.reduce((s, c) => s + c.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, cdSize, true);
        end.setUint32(16, offset, true);
        return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
    }

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    let toastTimer = 0;
    function toast(msg) {
        let el = document.querySelector(".toast");
        if (!el) {
            el = document.createElement("div");
            el.className = "toast";
            el.setAttribute("role", "status");
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
    }

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const t = document.createElement("textarea");
            t.value = text;
            document.body.appendChild(t);
            t.select();
            document.execCommand("copy");
            t.remove();
        }
        toast("Copiado!");
    }

    // Nome de pasta seguro para Windows
    function folderName(name, fallback) {
        const s = String(name || "").trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/[. ]+$/, "");
        return s || fallback;
    }

    // PNG do canvas em bytes (sincrono: texturas sao pequenas)
    function canvasToBytes(canvas) {
        const bin = atob(canvas.toDataURL("image/png").split(",")[1]);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function formatSize(bytes) {
        return bytes > 1e6 ? (bytes / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.round(bytes / 1024) + " KB";
    }

    return { makeZip, download, toast, copy, folderName, canvasToBytes, formatSize, crc32 };
})();
