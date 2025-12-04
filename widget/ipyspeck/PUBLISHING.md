# Publishing ipyspeck to PyPI

This guide explains how to build and publish ipyspeck to PyPI.

## Prerequisites

1. **PyPI Account**: Create accounts on both:
   - [Test PyPI](https://test.pypi.org/account/register/) (for testing)
   - [PyPI](https://pypi.org/account/register/) (for production)

2. **API Tokens**: Generate API tokens for authentication:
   - Go to Account Settings → API tokens
   - Create a token with "Upload packages" scope
   - Save the token securely (you won't see it again)

3. **Install Build Tools**:
   ```bash
   pip install build twine
   ```

## Pre-Release Checklist

Before publishing, ensure:

- [ ] All tests pass
- [ ] Version number is updated in:
  - [ ] `pyproject.toml` (version field)
  - [ ] `package.json` (version field)
  - [ ] `ipyspeck/_version.py`
  - [ ] `ipyspeck/speck.py` (MODULE_VERSION)
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] `README.md` is up to date
- [ ] All changes are committed to git
- [ ] Git tag created: `git tag v0.7.0`

## Building the Package

### 1. Clean Previous Builds

```bash
# Remove old build artifacts
rm -rf build/ dist/ *.egg-info
rm -rf ipyspeck/labextension ipyspeck/nbextension/index.js
npm run clean
```

### 2. Build JavaScript/TypeScript Components

```bash
# Install dependencies
npm install

# Build production assets
npm run build:prod
```

This will:
- Compile TypeScript to JavaScript
- Bundle the nbextension
- Build the labextension

### 3. Build Python Distribution

```bash
# Build source distribution and wheel
python -m build
```

This creates:
- `dist/ipyspeck-0.7.0.tar.gz` (source distribution)
- `dist/ipyspeck-0.7.0-py3-none-any.whl` (wheel)

### 4. Verify the Build

```bash
# Check the package contents
tar -tzf dist/ipyspeck-0.7.0.tar.gz | head -20

# Verify wheel contents
unzip -l dist/ipyspeck-0.7.0-py3-none-any.whl | head -20

# Check that labextension files are included
tar -tzf dist/ipyspeck-0.7.0.tar.gz | grep labextension
```

Ensure the following are included:
- `ipyspeck/labextension/` (with package.json and static/ directory)
- `ipyspeck/nbextension/` (with index.js)
- All Python source files
- README.md, LICENSE, etc.

### 5. Test the Package Locally

```bash
# Create a test environment
python -m venv test_env
source test_env/bin/activate  # On Windows: test_env\Scripts\activate

# Install the wheel
pip install dist/ipyspeck-0.7.0-py3-none-any.whl

# Test it works
python -c "from ipyspeck import Speck; w = Speck(); print('Success!')"

# Check labextension is installed
jupyter labextension list | grep ipyspeck

# Deactivate and remove test environment
deactivate
rm -rf test_env
```

## Publishing to Test PyPI (Recommended First Step)

Always test on Test PyPI before publishing to production PyPI.

### 1. Upload to Test PyPI

```bash
python -m twine upload --repository testpypi dist/*
```

When prompted:
- Username: `__token__`
- Password: Your Test PyPI API token (starts with `pypi-`)

### 2. Test Installation from Test PyPI

```bash
# Create a fresh test environment
python -m venv testpypi_env
source testpypi_env/bin/activate

# Install from Test PyPI
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ ipyspeck

# Test it works
python -c "from ipyspeck import Speck; print('Test PyPI install successful!')"
jupyter labextension list | grep ipyspeck

# Clean up
deactivate
rm -rf testpypi_env
```

Note: `--extra-index-url` is needed because dependencies (like ipywidgets) are on production PyPI.

## Publishing to Production PyPI

Once you've verified everything works on Test PyPI:

### 1. Upload to PyPI

```bash
python -m twine upload dist/*
```

When prompted:
- Username: `__token__`
- Password: Your PyPI API token (starts with `pypi-`)

### 2. Verify on PyPI

- Visit: https://pypi.org/project/ipyspeck/
- Check that version, description, and links are correct
- Download counts should start incrementing

### 3. Test Installation

```bash
# Create a fresh environment
python -m venv pypi_test_env
source pypi_test_env/bin/activate

# Install from PyPI
pip install ipyspeck

# Test
python -c "from ipyspeck import Speck; print('PyPI install successful!')"
jupyter labextension list | grep ipyspeck

# Clean up
deactivate
rm -rf pypi_test_env
```

## Post-Release

1. **Create GitHub Release**:
   ```bash
   git tag v0.7.0
   git push origin v0.7.0
   ```
   Then create a release on GitHub with the CHANGELOG entry

2. **Announce**:
   - Update project documentation
   - Announce on relevant channels
   - Update any examples or tutorials

## Troubleshooting

### Labextension Not Included in Package

If `ipyspeck/labextension/` is missing from the distribution:
- Ensure you ran `npm run build:prod` before `python -m build`
- Check `pyproject.toml` artifacts list includes labextension
- Verify build succeeded: `ls -la ipyspeck/labextension/`

### Version Conflicts

If you get "File already exists" error:
- You cannot upload the same version twice
- Increment the version number and rebuild
- For Test PyPI, you can delete old versions from the web interface

### Import Errors After Installation

If the package installs but imports fail:
- Check that `ipyspeck/__init__.py` exports the right classes
- Verify `_version.py` is included
- Test in a clean environment to rule out conflicts

### Labextension Not Loading in JupyterLab

If the widget doesn't work after installation:
- Check: `jupyter labextension list`
- Rebuild JupyterLab: `jupyter lab build`
- Clear browser cache and restart JupyterLab
- Check browser console for errors

## Using twine Configuration

To avoid entering credentials each time, create `~/.pypirc`:

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-YOUR_PRODUCTION_TOKEN_HERE

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-YOUR_TEST_TOKEN_HERE
```

**Important**: Keep this file secure! Add it to `.gitignore` globally.

Then you can simply run:
```bash
twine upload --repository testpypi dist/*  # For Test PyPI
twine upload dist/*                         # For production PyPI
```

## Automated Publishing with GitHub Actions

For automated releases, see `.github/workflows/publish.yml` (if available).

## References

- [Python Packaging Guide](https://packaging.python.org/)
- [PyPI Upload Guide](https://packaging.python.org/tutorials/packaging-projects/)
- [JupyterLab Extension Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
