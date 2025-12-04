# Changelog

All notable changes to ipyspeck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2024-12-04

### Added
- Support for ipywidgets 8.x while maintaining backward compatibility with ipywidgets 7.x
- Modern JupyterLab 3+ federated extension system support
- Dual lifecycle methods for PhosphorJS (legacy) and LuminoJS (modern) compatibility
- TypeScript-based widget implementation for better type safety and maintainability

### Changed
- **BREAKING**: Minimum Python version increased to 3.9
- **BREAKING**: Minimum JupyterLab version increased to 3.0
- Migrated from JupyterLab 2.x AMD module system to JupyterLab 3+ federated extensions
- Updated build system to use webpack 5 and modern tooling
- Updated @jupyterlab/builder to 4.5.0
- Removed upper bound on ipywidgets dependency (was `<8`, now `>=7.0`)
- Improved installation process - no manual extension installation required for JupyterLab 3+

### Fixed
- Widget loading errors in JupyterLab 3+ ("Error: No version of module ipyspeck is registered")
- Compatibility issues with ipywidgets 8.x
- Deprecated PhosphorJS usage warnings

### Migration Guide

#### For Users

**Upgrading from 0.6.x to 0.7.0:**

If you're using JupyterLab 3+ and ipywidgets 7+:
```bash
pip install --upgrade ipyspeck
```

If you're using older versions:
```bash
# Stay on 0.6.x for JupyterLab 2.x
pip install "ipyspeck<0.7"
```

**What's Changed:**
- No more manual `jupyter labextension install` needed for JupyterLab 3+
- Extension automatically installs and enables with `pip install`
- Widget behavior and API remain the same - no code changes needed

#### For Developers

**Key Infrastructure Changes:**
- Build system migrated from webpack 3 to webpack 5
- Added TypeScript compilation step
- Modern hatchling build backend with hatch-jupyter-builder
- Labextension now uses federated module system
- Widget implements both `processPhosphorMessage()` and `processLuminoMessage()` for compatibility

## [0.6.2] - 2023-XX-XX

### Previous Releases
- Support for JupyterLab 2.x
- ipywidgets 7.x support
- Streamlit integration
- Basic molecular visualization features

---

For older versions and detailed commit history, see the [GitHub releases page](https://github.com/denphi/speck/releases).
