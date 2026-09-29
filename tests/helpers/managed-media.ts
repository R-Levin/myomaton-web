import sharp from "sharp";

// Synthetic fixtures only; no customer bytes are checked in.
export function pdfFixture() {
  let text = "%PDF-1.7\n";
  const offsets = [0];
  for (const object of ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>"]) {
    offsets.push(Buffer.byteLength(text));
    text += `${offsets.length - 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(text);
  text += "xref\n0 4\n0000000000 65535 f \n" + offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(text + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

export async function mediaFixtures() {
  const raster = (format: "jpeg" | "png" | "webp") => sharp({ create: { width: 8, height: 6, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.3 } } })[format]().toBuffer();
  return [await raster("jpeg"), await raster("png"), await raster("webp"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 6"><path d="M0 0h8v6H0z" fill="red"/></svg>'), pdfFixture()];
}

export async function apngFixture() {
  const chunk = (type: string, data: Buffer) => {
    const payload = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, payload, checksum]);
  };
  const png = await sharp({ create: { width: 8, height: 6, channels: 4, background: "red" } }).png().toBuffer();
  const animation = Buffer.alloc(8); animation.writeUInt32BE(1); // One animated frame is still animation.
  const frame = Buffer.alloc(26); frame.writeUInt32BE(8, 4); frame.writeUInt32BE(6, 8); frame.writeUInt16BE(1, 20); frame.writeUInt16BE(10, 22);
  return Buffer.concat([png.subarray(0, 33), chunk("acTL", animation), chunk("fcTL", frame), png.subarray(33)]);
}
