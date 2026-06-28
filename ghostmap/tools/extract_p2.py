#!/usr/bin/env python3
"""
extract_p2.py — pull the PPCL program(s) out of a Siemens PXC-Modular panel
backup (.P2 / point-database export).

The backup is a sequence of records: each begins with 0x16 (SYN), carries an
ASCII-hex-encoded payload, and ends with CRLF. The decoded payload is a series
of TLV fields (type 0x01, 2-byte big-endian length, value). One field is the
program point name (e.g. GVL.CPPD.AHU7.PPCL); another is a single line of PPCL
text prefixed by its 5-digit line number. We group lines by program and write a
clean, line-numbered .pcl per program — ready to drop into GhostMap.

Usage:  python3 extract_p2.py PANEL.P2 [output_dir]
"""
import sys, re, collections, os

def decode(rec: bytes) -> bytes:
    rec = rec.lstrip(b"\x16")
    hx = bytes(c for c in rec if c in b"0123456789ABCDEFabcdef")
    if len(hx) % 2:
        hx = hx[:-1]
    try:
        return bytes.fromhex(hx.decode())
    except ValueError:
        return b""

def tlv_fields(d: bytes):
    out, i = [], 0
    while i + 3 <= len(d):
        if d[i] == 0x01:
            ln = (d[i + 1] << 8) | d[i + 2]
            v = d[i + 3 : i + 3 + ln]
            if len(v) == ln:
                out.append(v)
                i += 3 + ln
                continue
        i += 1
    return out

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    data = open(sys.argv[1], "rb").read()
    outdir = sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(outdir, exist_ok=True)

    progs = collections.defaultdict(dict)  # program name -> {line_no: text}
    for rec in data.split(b"\r\n"):
        d = decode(rec)
        if not d:
            continue
        fields = [f.decode("latin1") for f in tlv_fields(d)]
        prog = next((f for f in fields if re.fullmatch(r"GVL\.[A-Z0-9.]+\.PPCL", f)), None)
        line = next((f for f in fields if re.match(r"^V?\d{5}", f)), None)
        if not prog or not line:
            continue
        m = re.match(r"^V?(\d{5})\s?(.*)$", line, re.S)
        progs[prog][int(m.group(1))] = m.group(2).rstrip()

    for prog, lines in sorted(progs.items()):
        short = prog.split(".")[-2]  # e.g. AHU7
        path = os.path.join(outdir, f"{short}.pcl")
        with open(path, "w") as f:
            for ln in sorted(lines):
                f.write(f"{ln:05d}\t{lines[ln]}\n")
        print(f"{short:12} {len(lines):4} lines -> {path}")

if __name__ == "__main__":
    main()
