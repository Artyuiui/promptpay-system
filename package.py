#!/usr/bin/env python3
"""Package already-built artifacts without mixing the two projects' dependencies."""
from pathlib import Path
import hashlib, shutil, zipfile
root=Path(__file__).resolve().parent
dist=root/'dist';dist.mkdir(exist_ok=True)
apk=root/'promptpay-display-android/app/build/outputs/apk/debug/app-debug.apk'
if not apk.exists(): raise SystemExit('Build the Android debug APK first; see README.md')
shutil.copy2(apk,dist/'promptpay-display-debug.apk')
ext=root/'promptpay-sheets-extension'
with zipfile.ZipFile(dist/'promptpay-sheets-extension.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ext.rglob('*')):
        if p.is_file() and 'node_modules' not in p.parts:
            z.write(p,Path(ext.name)/p.relative_to(ext))
with zipfile.ZipFile(dist/'promptpay-system-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root)
        if p.is_file() and not any(part in {'dist','build','.gradle','.git','node_modules','__pycache__'} for part in rel.parts) and p.name not in {'local.properties','.DS_Store'}:
            z.write(p,Path(root.name)/rel)
files=sorted(p for p in dist.iterdir() if p.suffix in {'.apk','.zip'})
(dist/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in files))
for p in files: print(f'{p.name}: {p.stat().st_size:,} bytes')
