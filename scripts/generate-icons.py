"""Generate placeholder PWA icons. Run: python3 scripts/generate-icons.py"""
import struct, zlib, os

def create_png(size, filename):
    width = height = size
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = width // 2, height // 2
            radius = width // 3
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist < radius:
                raw += bytes([0x63, 0x66, 0xf1, 0xff])
            else:
                raw += bytes([0x1a, 0x1a, 0x2e, 0xff])

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    compressed = zlib.compress(raw)
    idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
    idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)
    print(f'Created {filename} ({size}x{size})')

create_png(192, 'public/icons/icon-192x192.png')
create_png(512, 'public/icons/icon-512x512.png')
