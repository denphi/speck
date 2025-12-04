# Release Checklist for ipyspeck 0.7.0

Quick checklist for releasing to PyPI.

## Pre-Release

- [x] All code changes complete
- [x] Tests passing
- [x] Version 0.7.0 set in all files
- [x] README.md updated with version compatibility warnings
- [x] CHANGELOG.md created with release notes
- [x] pyproject.toml metadata updated
- [x] webpack.config.js paths fixed (ipyspeck instead of ipyspeck_modern)

## Build

```bash
# Verify versions are consistent
python3 check_version.py

# Clean previous builds
rm -rf build/ dist/ *.egg-info
rm -rf ipyspeck/labextension ipyspeck/nbextension/index.js

# Build JavaScript/TypeScript
npm install
npm run build:lib && cp src/*.js lib/
npm run build:nbextension
/Users/denphi/Library/Python/3.10/bin/jupyter-labextension build .

# Verify build
python3 check_version.py

# Build Python package
python3 -m build
```

## Test Locally

```bash
# Create test environment
python3 -m venv test_env
source test_env/bin/activate

# Install from wheel
pip install dist/ipyspeck-0.7.0-py3-none-any.whl

# Test
python3 -c "from ipyspeck import Speck; w = Speck(); print('Success!', w._model_module_version)"
jupyter labextension list | grep ipyspeck

# Clean up
deactivate
rm -rf test_env
```

## Publish to Test PyPI

```bash
# Upload
python3 -m twine upload --repository testpypi dist/*

# Test install
python3 -m venv testpypi_env
source testpypi_env/bin/activate
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ ipyspeck
python3 -c "from ipyspeck import Speck; print('Test PyPI OK!')"
deactivate
rm -rf testpypi_env
```

## Publish to PyPI

```bash
# Upload to production PyPI
python3 -m twine upload dist/*

# Verify at: https://pypi.org/project/ipyspeck/
```

## Post-Release

```bash
# Tag the release
git add -A
git commit -m "Release v0.7.0

- Modern JupyterLab 3+ support
- ipywidgets 8.x compatibility
- Improved installation experience
- Updated documentation with version warnings
"
git tag v0.7.0
git push origin master
git push origin v0.7.0
```

## Create GitHub Release

1. Go to https://github.com/denphi/speck/releases/new
2. Tag: v0.7.0
3. Title: ipyspeck v0.7.0 - JupyterLab 3+ & ipywidgets 8 Support
4. Description: Copy from CHANGELOG.md
5. Attach: dist/ipyspeck-0.7.0.tar.gz and dist/ipyspeck-0.7.0-py3-none-any.whl
6. Publish release

## Verification

- [ ] PyPI page looks correct
- [ ] Can install with `pip install ipyspeck`
- [ ] Works in fresh JupyterLab environment
- [ ] GitHub release created
- [ ] Git tag pushed

## Common Issues

**Build fails**: Make sure all ipyspeck_modern references are removed
**Import error**: Check that __init__.py exports are correct
**Widget not loading**: Verify labextension is in ipyspeck/labextension/
**Version mismatch**: Run `python3 check_version.py`
