import * as ftp from 'basic-ftp';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Readable } from 'stream';

const gzip = promisify(zlib.gzip);

type FtpArgs = {
  xmlContent?: string;       // OpenImmo XML als String
  zipFileName?: string;      // z.B. "portal_inserat_001.zip"
  ftpHost?: string;
  ftpPort?: number;
  ftpUser?: string;
  ftpPassword?: string;
  ftpRemotePath?: string;    // z.B. "/import/"
  ftpSecure?: boolean;
};

// Einfaches ZIP mit einem File (ohne externe Lib, pure Node.js)
function createSimpleZip(filename: string, content: Buffer): Buffer {
  // Local File Header + Data + Central Directory — vereinfachtes ZIP
  // Wir nutzen Store (keine Komprimierung) für Kompatibilität
  const encoder = new TextEncoder();
  const name = Buffer.from(filename);
  const crc = crc32(content);
  const now = new Date();
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

  // Local file header
  const localHeader = Buffer.alloc(30 + name.length);
  localHeader.writeUInt32LE(0x04034b50, 0);  // Signature
  localHeader.writeUInt16LE(20, 4);           // Version needed
  localHeader.writeUInt16LE(0, 6);            // Flags
  localHeader.writeUInt16LE(0, 8);            // Compression (Store)
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(content.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);
  name.copy(localHeader, 30);

  const localOffset = 0;
  const dataStart = localHeader.length;

  // Central directory header
  const centralHeader = Buffer.alloc(46 + name.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(content.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(localOffset, 42);
  name.copy(centralHeader, 46);

  const centralDirOffset = localHeader.length + content.length;
  const centralDirSize = centralHeader.length;

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, content, centralHeader, eocd]);
}

function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

export const handler = async (event: { arguments?: FtpArgs }) => {
  const args = event.arguments ?? {};

  if (!args.ftpHost || !args.ftpUser || !args.ftpPassword) {
    return { ok: false, message: 'FTP-Zugangsdaten fehlen (Host, Benutzer, Passwort).' };
  }
  if (!args.xmlContent) {
    return { ok: false, message: 'Kein XML-Inhalt übergeben.' };
  }

  const xmlBuf = Buffer.from(args.xmlContent, 'utf-8');
  const xmlName = (args.zipFileName ?? 'portal_inserat').replace(/\.zip$/, '') + '.xml';
  const zipName = (args.zipFileName ?? 'portal_inserat') + '.zip';
  const zipBuf = createSimpleZip(xmlName, xmlBuf);

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: args.ftpHost,
      port: args.ftpPort ?? 21,
      user: args.ftpUser,
      password: args.ftpPassword,
      secure: args.ftpSecure ?? false,
    });

    const remotePath = args.ftpRemotePath ?? '/';
    await client.ensureDir(remotePath);

    const stream = Readable.from(zipBuf);
    await client.uploadFrom(stream, zipName);

    return { ok: true, message: `ZIP-Datei "${zipName}" erfolgreich auf ${args.ftpHost} hochgeladen.` };
  } catch (err: any) {
    return { ok: false, message: `FTP-Fehler: ${err?.message ?? String(err)}` };
  } finally {
    client.close();
  }
};
