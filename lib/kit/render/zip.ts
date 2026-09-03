import { crc32 } from "node:zlib";

/*
 * brand_kit_zip's container format — a minimal, hand-written ZIP writer.
 *
 * STORED entries only (compression method 0, no deflate): every file this
 * kit produces is already a compressed format (PNG) or small text (SVG,
 * JSON, CSS, HTML, MD) — deflating a PNG a second time saves close to
 * nothing, and STORED sidesteps the one real correctness risk a hand-built
 * deflate implementation would carry (getting the compressed stream's
 * framing subtly wrong) for a total cost of a few kilobytes on the small
 * text files. Fully spec-compliant: STORED is part of the ZIP format
 * itself, not a shortcut real tools fail to open — Explorer, Finder, and
 * every common archive tool read it identically to a deflated one.
 *
 * Layout (APPNOTE.TXT, the de facto ZIP spec): one local file header + data
 * per entry, then one central directory file header per entry, then the end
 * of central directory record. All multi-byte fields little-endian.
 */

type ZipEntry = { name: string; data: Buffer };

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/** MS-DOS date/time, fixed rather than `Date.now()`: a deterministic renderer produces identical bytes for identical inputs, including this container. */
const DOS_TIME = 0;
// DOS date bit layout: bits 9-15 year-since-1980, 5-8 month, 0-4 day.
// Year offset 0 => 1980 (the DOS epoch) — verified against `unzip -l`,
// which caught a first draft that had this one year off (offset 1).
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

function localFileHeader(entry: ZipEntry, crc: number): Buffer {
  const nameBytes = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(0, 8); // method: stored
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(entry.data.length, 18); // compressed size
  header.writeUInt32LE(entry.data.length, 22); // uncompressed size
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, nameBytes]);
}

function centralDirHeader(entry: ZipEntry, crc: number, localHeaderOffset: number): Buffer {
  const nameBytes = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
  header.writeUInt16LE(20, 4); // version made by
  header.writeUInt16LE(20, 6); // version needed
  header.writeUInt16LE(0, 8); // flags
  header.writeUInt16LE(0, 10); // method: stored
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(entry.data.length, 20); // compressed size
  header.writeUInt32LE(entry.data.length, 24); // uncompressed size
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30); // extra field length
  header.writeUInt16LE(0, 32); // comment length
  header.writeUInt16LE(0, 34); // disk number start
  header.writeUInt16LE(0, 36); // internal attributes
  header.writeUInt32LE(0o644 << 16, 38); // external attributes: unix rw-r--r--
  header.writeUInt32LE(localHeaderOffset, 42);
  return Buffer.concat([header, nameBytes]);
}

export function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const crc = crc32(entry.data);
    const local = localFileHeader(entry, crc);
    localParts.push(local, entry.data);
    centralParts.push(centralDirHeader(entry, crc, offset));
    offset += local.length + entry.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const centralDirOffset = offset;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralDir.length, 12); // central dir size
  end.writeUInt32LE(centralDirOffset, 16); // central dir offset
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDir, end]);
}
