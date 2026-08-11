"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("../../src/lib/pdf/parser");
const types_1 = require("../../src/lib/pdf/types");
const fs = __importStar(require("fs"));
const cases = [
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/arxiv-dual-column.pdf', 'arxiv-dual'],
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/dummy.pdf', 'dummy(single)'],
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/multicol.pdf', 'multicol(3col)'],
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-test/corrupt.pdf', 'corrupt'],
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/images.pdf', 'images(scan)'],
    ['G:/autoclaw/aifanyi/.openclaw/tmp/pdf-samples/encrypted.pdf', 'encrypted'],
];
(async () => {
    for (const [p, label] of cases) {
        if (!fs.existsSync(p)) {
            console.log('SKIP', label, '(missing)');
            continue;
        }
        const buf = fs.readFileSync(p);
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        try {
            const doc = await (0, parser_1.parsePdf)(ab, label);
            const types = {};
            for (const pg of doc.pages)
                for (const b of pg.blocks)
                    types[b.type] = (types[b.type] || 0) + 1;
            console.log(`OK ${label}: pages=${doc.pageCount} dual=${doc.limitations.length > 0} blocks=${JSON.stringify(types)}`);
        }
        catch (e) {
            if (e instanceof types_1.PdfError)
                console.log(`ERR ${label}: type=${e.errorType}`);
            else
                console.log(`ERR ${label}: ${e?.name}`);
        }
    }
})();
