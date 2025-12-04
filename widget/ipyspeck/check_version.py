#!/usr/bin/env python
"""
Check that version numbers are consistent across all files.
Run this before publishing to ensure version consistency.
"""

import json
import re
import sys
from pathlib import Path

def get_version_from_file(filepath, pattern):
    """Extract version from a file using a regex pattern."""
    content = Path(filepath).read_text()
    match = re.search(pattern, content)
    if match:
        return match.group(1)
    return None

def main():
    root = Path(__file__).parent

    # Define where to find versions
    version_sources = {
        'pyproject.toml': (
            root / 'pyproject.toml',
            r'version\s*=\s*["\']([^"\']+)["\']',
        ),
        'package.json': (
            root / 'package.json',
            r'"version"\s*:\s*"([^"]+)"',
        ),
        'ipyspeck/_version.py': (
            root / 'ipyspeck' / '_version.py',
            r'version_info\s*=\s*\((\d+),\s*(\d+),\s*(\d+)',
        ),
        'ipyspeck/speck.py': (
            root / 'ipyspeck' / 'speck.py',
            r"_(?:view|model)_module_version\s*=\s*Unicode\(['\"][\^~]?([^'\"]+)['\"]",
        ),
    }

    versions = {}
    errors = []

    # Extract versions
    for name, (filepath, pattern) in version_sources.items():
        if not filepath.exists():
            errors.append(f"❌ File not found: {filepath}")
            continue

        if name == 'ipyspeck/_version.py':
            # Special handling for version_info tuple
            match = re.search(pattern, filepath.read_text())
            if match:
                version = f"{match.group(1)}.{match.group(2)}.{match.group(3)}"
                versions[name] = version
            else:
                errors.append(f"❌ Could not parse version from {name}")
        else:
            version = get_version_from_file(filepath, pattern)
            if version:
                versions[name] = version
            else:
                errors.append(f"❌ Could not parse version from {name}")

    # Print results
    print("=" * 60)
    print("VERSION CONSISTENCY CHECK")
    print("=" * 60)
    print()

    if versions:
        print("Found versions:")
        for name, version in versions.items():
            print(f"  {name:30s} → {version}")
        print()

    # Check consistency
    unique_versions = set(versions.values())

    if len(unique_versions) == 1:
        print(f"✅ All versions match: {unique_versions.pop()}")
        success = True
    else:
        print("❌ Version mismatch detected!")
        print()
        print("Versions found:")
        for v in sorted(unique_versions):
            files = [name for name, ver in versions.items() if ver == v]
            print(f"  {v}:")
            for f in files:
                print(f"    - {f}")
        success = False

    print()

    # Print any errors
    if errors:
        print("Errors encountered:")
        for error in errors:
            print(f"  {error}")
        print()
        success = False

    # Check for common issues
    print("Additional checks:")

    # Check CHANGELOG
    changelog = root / 'CHANGELOG.md'
    if changelog.exists():
        content = changelog.read_text()
        if versions and any(v in content for v in versions.values()):
            print(f"  ✅ CHANGELOG.md mentions current version")
        else:
            print(f"  ⚠️  CHANGELOG.md may need updating")
    else:
        print(f"  ⚠️  CHANGELOG.md not found")

    # Check for built artifacts
    labext = root / 'ipyspeck' / 'labextension' / 'package.json'
    nbext = root / 'ipyspeck' / 'nbextension' / 'index.js'

    if labext.exists():
        print(f"  ✅ Labextension built")
    else:
        print(f"  ❌ Labextension not built (run: npm run build:prod)")
        success = False

    if nbext.exists():
        print(f"  ✅ Nbextension built")
    else:
        print(f"  ❌ Nbextension not built (run: npm run build:prod)")
        success = False

    print()
    print("=" * 60)

    if success:
        print("✅ Ready for release!")
        return 0
    else:
        print("❌ Please fix the issues above before releasing")
        return 1

if __name__ == '__main__':
    sys.exit(main())
