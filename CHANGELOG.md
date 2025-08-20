# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-08-20

### Added

- **🏥 Repository Health Monitoring**: Complete health analysis system with 6-dimension scoring
  - Code Quality, Security, Collaboration, Maintenance, Activity, and Structure analysis
  - Comprehensive health reports with actionable insights and recommendations
  - CLI integration with `--health` flag and export options (`--health-export`)
  - Health scoring algorithms with configurable thresholds

- **🎨 Enhanced Visualization & Interactive Dashboard**: Advanced ASCII art visualization system
  - Enhanced branch tree with metadata, grouping, and beautiful icons
  - Activity heatmap with calendar-style layout and intensity levels
  - Repository timeline showing events, dates, and contributors
  - Comprehensive dashboard with metrics, charts, and statistics
  - Standalone `viz` command with theme support (dark/light)
  - Multiple visualization types: tree, heatmap, timeline, dashboard, charts, calendar

- **⚙️ Advanced Configuration System**: Enterprise-grade configuration management
  - Configuration profiles for different project types (enterprise, opensource, personal, team, custom)
  - Environment-specific settings (development, staging, production, testing, local)
  - Profile management CLI: create, list, show, use, delete profiles
  - Configuration templates and automated setup workflows
  - Import/export functionality for configuration backup and sharing

### Enhanced

- **CLI Interface**: Comprehensive command structure with subcommands
  - `bramble profiles` - Profile management commands
  - `bramble environments` - Environment configuration commands
  - `bramble templates` - Template management commands
  - `bramble viz` - Standalone visualization commands

- **Type System**: Extensive TypeScript type definitions for all new features
- **Error Handling**: Improved error handling and user feedback
- **Documentation**: Enhanced help text and usage examples

### Technical Improvements

- **Service Architecture**: Modular service-oriented design
  - `RepositoryHealthService` - Health monitoring and analysis
  - `EnhancedVisualizationEngine` - Advanced visualization rendering
  - `AdvancedConfigManager` - Configuration and profile management
- **Performance**: Optimized analysis and visualization rendering
- **Compatibility**: Enhanced terminal compatibility with ASCII art fallbacks

## [1.2.1] - 2025-08-19

### Added

- **Branch Type Column**: New "Type" column in branch list showing whether each branch is LOCAL or REMOTE
- **Enhanced Repository Statistics**: Repository overview now displays separate counts for local and remote branches
- **Better Branch Visibility**: Improved branch management with clear type identification

### Fixed

- **Remote Branches Configuration**: Fixed critical bug where `includeRemoteBranches` configuration option was not being respected
- **Branch Analysis**: Remote branches are now correctly included/excluded based on user configuration settings
- **Git Operations**: Improved handling of remote branch names and mapping between different Git reference formats

### Enhanced

- **UI Layout**: Adjusted branch list column widths to accommodate the new branch type information
- **Legend**: Updated UI legend to explain LOCAL vs REMOTE branch type indicators
- **Type Safety**: Enhanced TypeScript type definitions for better branch type handling

## [1.2.0] - 2025-08-19

### Added

- **Enhanced Branch Information**: Branch list now displays last commit author and human-readable commit time
- **Advanced Performance Mode**: Optimized analysis for large repositories with parallel processing
- **Smart Branch Filtering**: Intelligent filtering that preserves important branches (current/default)
- **Performance Guide**: Comprehensive documentation for handling large repositories
- **Bulk Git Operations**: Improved efficiency through batched Git commands

### Enhanced

- **Default Branch Detection**: Improved logic prioritizing Git remote HEAD and user configurations
- **Branch Display**: Enhanced UI with clearer status indicators ("STALE", "CONFCT")
- **Repository Analysis**: Current and default branches are always included regardless of staleness
- **UI Navigation**: Fixed shortcut conflicts and scrolling issues in branch view
- **Large Repository Support**: Better handling of repositories with 100+ branches

### Changed

- **GitAnalyzer**: Enhanced branch filtering and analysis logic
- **UI Views**: Improved branch list with additional context columns
- **Branch Prioritization**: Default and current branches are prioritized in sorted lists
- **Code Organization**: Removed duplicate analyzer implementations for cleaner codebase

### Fixed

- **Branch View Navigation**: Resolved keyboard shortcut conflicts
- **Scrolling Issues**: Fixed UI scrolling problems in branch view
- **Branch Filtering**: Prevented accidental removal of important branches
- **Performance**: Addressed slowdowns in repositories with many branches

### Technical Improvements

- Added parallel processing capabilities for branch analysis
- Implemented smart caching mechanisms for Git operations
- Enhanced error handling and recovery in large repositories
- Improved memory management for bulk operations
- Added comprehensive performance monitoring and optimization

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
