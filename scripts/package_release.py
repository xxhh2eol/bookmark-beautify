#!/usr/bin/env python3
"""Validate a tagged version and package only the extension's runtime files."""

import argparse
import json
from pathlib import Path
import re
import zipfile

RUNTIME_FILES = (
    'manifest.json',
    'newtab-external.html',
    'app.js',
    'app.css',
    'background.js',
    'LICENSE',
)


def package_release(source, tag, output):
    if not re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', tag):
        raise ValueError('Tag must have the form vMAJOR.MINOR.PATCH')
    root = Path(source).resolve()
    for name in RUNTIME_FILES + ('CHANGELOG.md',):
        file = root / name
        if file.is_symlink() or not file.is_file():
            raise ValueError('Missing regular release file: ' + name)

    version = tag[1:]
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('version') != version:
        raise ValueError('Tag does not match manifest.json version')
    entrypoints = list(manifest.get('chrome_url_overrides', {}).values())
    worker = manifest.get('background', {}).get('service_worker')
    if worker:
        entrypoints.append(worker)
    if any(name not in RUNTIME_FILES for name in entrypoints):
        raise ValueError('Manifest references an entrypoint outside the release file list')

    changelog = (root / 'CHANGELOG.md').read_text(encoding='utf-8')
    pattern = r'^## \[' + re.escape(version) + r'\][^\n]*\n(.*?)(?=^## |\Z)'
    match = re.search(pattern, changelog, flags=re.MULTILINE | re.DOTALL)
    if not match:
        raise ValueError('CHANGELOG.md is missing the tagged version')
    # Link definitions belong to the document, not to the release body.
    notes = re.split(r'^\[[^\]]+\]:\s', match.group(1), maxsplit=1, flags=re.MULTILINE)[0].strip()
    if not notes:
        raise ValueError('The tagged changelog section is empty')

    destination = Path(output)
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / ('bookmark-beautify-' + tag + '.zip')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        for name in RUNTIME_FILES:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, (root / name).read_bytes())
    notes_file = destination / 'release-notes.md'
    notes_file.write_text(notes + '\n', encoding='utf-8')
    return archive, notes_file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='.')
    parser.add_argument('--tag', required=True)
    parser.add_argument('--output', default='release')
    args = parser.parse_args()
    try:
        archive, notes = package_release(args.source, args.tag, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, 'Release validation failed: ' + str(error) + '\n')
    print('Package: ' + str(archive))
    print('Notes: ' + str(notes))


if __name__ == '__main__':
    main()
