"""Release checks use synthetic files and never access browser data."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    'package_release', Path(__file__).resolve().parents[1] / 'scripts' / 'package_release.py'
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / 'source'
        self.root.mkdir()
        self.output = Path(self.directory.name) / 'output'
        for name in release.RUNTIME_FILES:
            (self.root / name).write_text('synthetic runtime file\n', encoding='utf-8')
        (self.root / 'manifest.json').write_text(json.dumps({
            'version': '1.2.3', 'chrome_url_overrides': {'newtab': 'newtab-external.html'},
            'background': {'service_worker': 'background.js'}
        }), encoding='utf-8')
        (self.root / 'CHANGELOG.md').write_text(
            '# Changelog\n\n## [1.2.3] - 2026-10-01\n\nNew version notes.\n\n'
            '## [1.2.2] - 2026-09-01\n\nOld notes.\n\n[1.2.3]: https://example.com/compare\n',
            encoding='utf-8'
        )

    def package(self, tag='v1.2.3'):
        return release.package_release(self.root, tag, self.output)

    def test_archive_excludes_notes_tests_credentials_and_personal_exports(self):
        for name in ('.env', 'bookmarks-export.html', 'index.html', 'private-notes.md'):
            (self.root / name).write_text('synthetic private fixture', encoding='utf-8')
        archive, notes = self.package()
        with zipfile.ZipFile(archive) as bundle:
            self.assertEqual(set(bundle.namelist()), set(release.RUNTIME_FILES))
            self.assertIsNone(bundle.testzip())
            self.assertEqual(json.loads(bundle.read('manifest.json'))['version'], '1.2.3')
        self.assertEqual(notes.read_text(encoding='utf-8'), 'New version notes.\n')

    def test_last_version_notes_exclude_markdown_link_definitions(self):
        (self.root / 'CHANGELOG.md').write_text(
            '## [1.2.3] - 2026-10-01\n\nOnly release notes.\n\n[1.2.3]: https://example.com/compare\n',
            encoding='utf-8'
        )
        _, notes = self.package()
        self.assertEqual(notes.read_text(encoding='utf-8'), 'Only release notes.\n')

    def test_wrong_version_never_creates_an_archive(self):
        with self.assertRaisesRegex(ValueError, 'does not match'):
            self.package('v9.9.9')
        self.assertFalse(self.output.exists())

    def test_invalid_tag_cannot_become_a_path_or_shell_command(self):
        for tag in ('../v1.2.3', 'v1.2.3;echo test', 'main', 'v1.2.3-rc1'):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                self.package(tag)
        self.assertFalse(self.output.exists())

    def test_missing_or_empty_changelog_fails_before_packaging(self):
        for content in ('## [1.2.2]\nOld notes.\n', '## [1.2.3]\n\n'):
            (self.root / 'CHANGELOG.md').write_text(content, encoding='utf-8')
            with self.assertRaises(ValueError):
                self.package()
        self.assertFalse(self.output.exists())

    def test_missing_file_and_symlink_fail_before_packaging(self):
        file = self.root / 'app.js'
        file.unlink()
        with self.assertRaises(ValueError):
            self.package()
        file.symlink_to(self.root / 'app.css')
        with self.assertRaises(ValueError):
            self.package()
        self.assertFalse(self.output.exists())

    def test_repeated_packaging_is_deterministic(self):
        archive, _ = self.package()
        first = archive.read_bytes()
        archive, _ = self.package()
        self.assertEqual(first, archive.read_bytes())


if __name__ == '__main__':
    unittest.main()
