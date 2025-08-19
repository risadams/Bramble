# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-08-19

### Added
- **Progress Indicators**: Comprehensive progress tracking for repository analysis
  - Visual progress bars with percentage completion and item counts
  - ETA calculation for repositories with many branches (>10 branches)
  - Real-time display of current branch being analyzed
  - Animated spinner during initialization phase
- **Quiet Mode**: New `--quiet` flag to disable progress indicators for automated scripts
- **Enhanced User Experience**:
  - Two-tier progress display (repository-level and branch-level)
  - Improved verbose output with detailed statistics summary
  - Better completion messages with analysis results
  - Enhanced help documentation with usage examples

### Changed
- `GitAnalyzer.analyze()` method now accepts optional progress callback
- Improved terminal output formatting and cleanup
- Enhanced CLI help text with examples and feature descriptions
- Better error handling during progress display

### Fixed
- Analysis no longer appears to hang on repositories with many branches
- Improved user feedback during long-running operations

### Technical Details
- Added `ProgressIndicator` and `SpinnerIndicator` utility classes
- Implemented `ProgressCallback` interface for non-blocking progress reporting
- Memory-efficient progress tracking with minimal overhead
- TypeScript-safe implementation with proper type definitions

## [1.0.0] - 2025-08-19

### Added
- Initial release of Bramble - Terminal Git Analysis Tool
- Advanced git branch analysis and visualization
- Interactive terminal UI with blessed framework
- Branch relationship analysis and statistics
- Stale branch detection and commit pattern analysis
- Export capabilities (JSON, HTML, CSV, Markdown)
- ASCII branch tree diagrams and activity heatmaps
- Configuration management system
- Terminal compatibility mode for various environments

### Features
- Branch statistics dashboard
- Activity heatmaps and commit frequency analysis
- Contributor tracking and analysis
- Merge conflict detection
- Branch divergence analysis
- Interactive keyboard navigation
- Modular TypeScript architecture with strict type checking
