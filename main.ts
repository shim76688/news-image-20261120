// "The World Today" — Friday 20 November 2026.
// A program that draws a newspaper front page summing up the day's world
// news and writes it to /output/entry.png. Node 22, standard library only.
// Every pixel is drawn by this program; nothing is read from disk but the
// code itself. Deterministic: no clock, no randomness, no network.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

// ---- palette ----
const CREAM: [number, number, number] = [247, 241, 227];
const PAPER: [number, number, number] = [255, 253, 246];
const NAVY: [number, number, number] = [20, 33, 61];
const GOLD: [number, number, number] = [217, 164, 65];
const RED: [number, number, number] = [178, 34, 34];
const INK: [number, number, number] = [24, 28, 38];
const GREY: [number, number, number] = [96, 101, 112];
const TEAL: [number, number, number] = [14, 110, 110];
const SKY: [number, number, number] = [127, 179, 213];
const WHITE: [number, number, number] = [255, 255, 255];
const SAND: [number, number, number] = [232, 220, 190];

type RGB = [number, number, number];

// ---- canvas ----
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function hLine(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vLine(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const steps = Math.max(dx, dy);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPixel(cx + x, cy + y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let y = -r - t; y <= r + t; y++) {
    for (let x = -r - t; x <= r + t; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (Math.abs(d - r) <= t / 2 + 0.4) setPixel(cx + x, cy + y, c);
    }
  }
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, c: RGB, t = 3): void {
  for (let a = a0; a <= a1; a += 0.03) {
    const x = Math.round(cx + r * Math.cos(a));
    const y = Math.round(cy + r * Math.sin(a));
    fillRect(x - 1, y - 1, t, t, c);
  }
}

// ---- 5x7 bitmap font: each glyph is 7 rows, 5 bits each (bit 4 = left) ----
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 1, 14],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 6, 4, 0, 4],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '&': [12, 18, 20, 8, 21, 18, 13],
  $: [4, 15, 20, 14, 5, 30, 4],
  '%': [25, 26, 2, 4, 8, 11, 19],
  '·': [0, 0, 0, 12, 12, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
};

function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch] ?? FONT[' '];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r] & (16 >> col)) fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) {
    drawChar(s[i], x + i * 6 * scale, y, scale, c);
  }
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---- pictograms (flat, drawn with the primitives above) ----
function drawStorm(cx: number, cy: number): void {
  // spiral cloud
  arc(cx, cy, 44, 0.3, 5.6, NAVY, 5);
  arc(cx, cy, 30, 2.2, 7.2, TEAL, 5);
  arc(cx, cy, 17, 4.0, 8.8, GOLD, 5);
  disc(cx, cy, 6, RED);
  // rain streaks
  for (const [dx, dy] of [[-38, 52], [-14, 60], [10, 54], [34, 62]] as const) {
    line(cx + dx, cy + dy, cx + dx - 8, cy + dy + 18, SKY, 4);
  }
}

function drawFlags(cx: number, cy: number): void {
  // two flag poles with flags, a small olive branch below
  vLine(cx - 26, cy - 44, 88, INK, 3);
  vLine(cx + 26, cy - 44, 88, INK, 3);
  // EU-style flag: blue field, ring of gold dots
  fillRect(cx - 24, cy - 44, 40, 26, [0, 51, 153]);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    disc(Math.round(cx - 4 + 9 * Math.cos(a)), Math.round(cy - 31 + 9 * Math.sin(a)), 2, GOLD);
  }
  // tricolour flag
  fillRect(cx + 28, cy - 44, 40, 9, WHITE);
  fillRect(cx + 28, cy - 35, 40, 9, [0, 57, 166]);
  fillRect(cx + 28, cy - 26, 40, 8, RED);
  // olive branch
  line(cx - 30, cy + 44, cx + 30, cy + 44, TEAL, 4);
  for (const dx of [-20, -6, 8, 22] as const) {
    line(cx + dx, cy + 44, cx + dx - 8, cy + 34, TEAL, 3);
  }
}

function drawDrone(cx: number, cy: number): void {
  // quadcopter: body, four arms, four rotors
  fillRect(cx - 18, cy - 10, 36, 20, NAVY);
  disc(cx, cy, 6, GOLD);
  for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const ex = cx + ax * 42;
    const ey = cy + ay * 30;
    line(cx + ax * 14, cy + ay * 8, ex, ey, INK, 4);
    hLine(ex - 18, ey - 2, 36, GREY, 3);
    disc(ex, ey, 6, RED);
  }
}

function drawBaseball(cx: number, cy: number): void {
  disc(cx, cy, 42, WHITE);
  ring(cx, cy, 42, RED, 3);
  arc(cx - 6, cy, 30, -1.1, 1.1, RED, 3);
  arc(cx + 6, cy, 30, Math.PI - 1.1, Math.PI + 1.1, RED, 3);
  for (const [sx, sy] of [[-24, -18], [-30, 0], [-24, 18], [24, -18], [30, 0], [24, 18]] as const) {
    line(cx + sx, cy + sy, cx + sx + 8, cy + sy + 4, RED, 2);
  }
}

function drawChart(cx: number, cy: number): void {
  // rising bars + arrow
  const base = cy + 40;
  const bars: [number, number, RGB][] = [
    [-42, 22, TEAL],
    [-12, 38, GOLD],
    [18, 56, RED],
  ];
  for (const [dx, h, c] of bars) {
    fillRect(cx + dx, base - h, 24, h, c);
  }
  hLine(cx - 52, base, 110, INK, 3);
  line(cx - 48, cy + 8, cx + 44, cy - 34, INK, 4);
  line(cx + 44, cy - 34, cx + 30, cy - 34, INK, 4);
  line(cx + 44, cy - 34, cx + 44, cy - 20, INK, 4);
}

// ---- layout ----
fillRect(0, 0, W, H, CREAM);

// masthead
fillRect(0, 0, W, 152, NAVY);
const title = 'THE WORLD TODAY';
drawText(title, Math.round((W - textWidth(title, 6)) / 2), 26, 6, WHITE);
const date = 'FRIDAY 20 NOVEMBER 2026';
drawText(date, Math.round((W - textWidth(date, 4)) / 2), 96, 4, GOLD);
hLine(0, 152, W, GOLD, 5);

// lead story: cyclone
const leadY = 176;
drawText('INDIA · CYCLONE', 32, leadY, 2, RED);
const leadHead = wrap("CYCLONE AKVAN SLAMS INDIA'S EAST COAST", 19);
leadHead.forEach((ln, i) => drawText(ln, 32, leadY + 30 + i * 42, 5, INK));
const leadSum = wrap('MORE THAN 300,000 PEOPLE EVACUATED AS THE STORM MAKES LANDFALL IN ODISHA.', 34);
leadSum.forEach((ln, i) => drawText(ln, 32, leadY + 132 + i * 26, 3, GREY));
// lead pictogram panel
fillRect(716, leadY - 8, 276, 208, PAPER);
vLine(716, leadY - 8, 208, SAND, 2);
drawStorm(854, leadY + 78);
hLine(32, 400, 960, INK, 3);

// grid: 2 x 2
type Story = { kicker: string; kickerColor: RGB; head: string; sum: string; pic: (cx: number, cy: number) => void };
const stories: Story[] = [
  {
    kicker: 'EUROPE · UKRAINE WAR',
    kickerColor: TEAL,
    head: 'EUROPE READY FOR TALKS WITH RUSSIA',
    sum: 'LEADERS SIGNAL OPENNESS TO NEGOTIATIONS TO END THE WAR IN UKRAINE.',
    pic: drawFlags,
  },
  {
    kicker: 'ITALY · SECURITY',
    kickerColor: RED,
    head: 'MYSTERY DRONES SHUT GENOA AIRPORT',
    sum: 'FLIGHTS SUSPENDED FOR FOUR HOURS AFTER DRONES SPOTTED OVERNIGHT.',
    pic: drawDrone,
  },
  {
    kicker: 'UNITED STATES · BASEBALL',
    kickerColor: TEAL,
    head: 'TRUMP PARDONS PETE ROSE',
    sum: 'POSTHUMOUS PARDON FOR THE BANNED ALL-TIME HITS KING.',
    pic: drawBaseball,
  },
  {
    kicker: 'SOUTH KOREA · BUSINESS',
    kickerColor: RED,
    head: 'KAKAO FOUNDER CLEARED ON APPEAL',
    sum: 'COURT UPHOLDS ACQUITTAL IN STOCK MANIPULATION CASE.',
    pic: drawChart,
  },
];

const cellW = 472;
const cellH = 218;
const cellX = [24, 528];
const cellY = [424, 662];
stories.forEach((st, idx) => {
  const x = cellX[idx % 2];
  const y = cellY[Math.floor(idx / 2)];
  fillRect(x, y, cellW, cellH, PAPER);
  hLine(x, y, cellW, st.kickerColor, 4);
  drawText(st.kicker, x + 16, y + 14, 2, st.kickerColor);
  const headLines = wrap(st.head, 13);
  headLines.forEach((ln, i) => drawText(ln, x + 16, y + 40 + i * 34, 4, INK));
  const sumLines = wrap(st.sum, 24);
  sumLines.forEach((ln, i) => drawText(ln, x + 16, y + 40 + headLines.length * 34 + 6 + i * 24, 3, GREY));
  st.pic(x + cellW - 62, y + 52);
});

// footer
const footY = 908;
hLine(24, footY, 976, INK, 3);
drawText('ALSO TODAY', 24, footY + 14, 2, RED);
drawText('KYIV HIT BY FOUR BALLISTIC MISSILES.', 24, footY + 38, 3, INK);
drawText('U.N. CHIEF RACE STALLS AFTER 8 ROUNDS OF VOTING.', 24, footY + 64, 3, INK);
drawText('SOURCES: THE HINDU · BBC · REUTERS · THE JAPAN TIMES', 24, 1000, 2, GREY);

// ---- PNG encode ----
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
writeFileSync(join(outDir, 'entry.png'), png);
