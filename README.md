# Bramble

<p align="center">
  <img width="1280" src="assets/logo_4x.png">
</p>

A terminal-based tool for advanced git branch analysis and visualization, providing insights into branch relationships, commit patterns, and repository health metrics with enterprise-grade features.

## ✨ Features

### 🏥 Repository Health Monitoring

- **6-Dimension Health Analysis**: Code Quality, Security, Collaboration, Maintenance, Activity, and Structure
- **Comprehensive Health Reports**: Actionable insights with specific recommendations
- **Health Scoring**: Quantitative assessment with improvement suggestions
- **Export Support**: Generate health reports in JSON and Markdown formats

### 🎨 Enhanced Visualizations

- **Enhanced Branch Tree**: Hierarchical branch structure with metadata and beautiful ASCII art
- **Activity Heatmap**: Calendar-style commit activity visualization with intensity levels
- **Repository Timeline**: Chronological view of repository events and milestones
- **Interactive Dashboard**: Comprehensive metrics, charts, and statistics
- **Multiple Themes**: Dark, light, and customizable visualization themes

### ⚙️ Advanced Configuration System

- **Configuration Profiles**: Pre-built profiles for Enterprise, Open Source, Personal, Team, and Custom setups
- **Environment Management**: Development, staging, production, testing, and local environment support
- **Template System**: Automated setup workflows for different project types
- **Import/Export**: Configuration backup and sharing capabilities

### 🌿 Core Analysis Features

- **Advanced Branch Analysis**: Comprehensive analysis of all branches in your repository
- **Visual Statistics**: Interactive terminal dashboard with branch metrics
- **Stale Branch Detection**: Identify abandoned or inactive branches
- **Activity Tracking**: Monitor commit patterns and contributor activity
- **Progress Indicators**: Real-time progress tracking with ETA for large repositories
- **Export Capabilities**: Generate reports in JSON, HTML, CSV, and Markdown formats
- **Fast Performance**: Handles repositories with 100+ branches efficiently
- **Script-Friendly**: Quiet mode for automated workflows and CI/CD integration

## Installation

### Option 1: Using npx (Recommended)

```bash
# Run directly without installation
npx @risadams/bramble analyze .
npx @risadams/bramble analyze /path/to/repo
```

### Option 2: Global Installation

```bash
npm install -g @risadams/bramble
bramble analyze .
```

### Option 3: Local Development

```bash
git clone https://github.com/risadams/bramble.git
cd bramble
npm install
npm run build
npm start analyze .
```

## Usage

### Basic Analysis

```bash
# Using npx (no installation required)
npx @risadams/bramble analyze .
npx @risadams/bramble analyze /path/to/repo

# Using global installation
bramble analyze .
bramble analyze /path/to/repo
```

### Advanced Options

```bash
# Output options
npx @risadams/bramble analyze . -o html           # Export to HTML
npx @risadams/bramble analyze . -o json           # Export to JSON
npx @risadams/bramble analyze . --export report.md # Export to file

# Display options
npx @risadams/bramble analyze . --ascii           # ASCII mode for compatibility
npx @risadams/bramble analyze . -v                # Verbose output
npx @risadams/bramble analyze . --quiet           # Disable progress indicators (scripts/CI)

# Batch processing
npx @risadams/bramble analyze . --batch           # Batch mode for multiple repos
```

### Repository Health Analysis

```bash
# Generate comprehensive health report
npx @risadams/bramble health .
npx @risadams/bramble health . --format json
npx @risadams/bramble health . --export health-report.md
```

### Enhanced Visualizations

```bash
# View branch tree visualization
npx @risadams/bramble visualize tree

# View activity heatmap
npx @risadams/bramble visualize heatmap

# View repository timeline
npx @risadams/bramble visualize timeline

# Interactive dashboard
npx @risadams/bramble dashboard
```

### Configuration Management

```bash
# Profile management
npx @risadams/bramble profiles list
npx @risadams/bramble profiles create enterprise
npx @risadams/bramble profiles set enterprise

# Environment management
npx @risadams/bramble environments current
npx @risadams/bramble environments set production

# Template management
npx @risadams/bramble templates list
npx @risadams/bramble templates apply open-source
```

## Interactive Interface

Once launched, Bramble provides an interactive terminal interface with:

- **Overview Dashboard**: Repository statistics and health metrics
- **Branch Explorer**: Detailed view of all branches with sorting/filtering
- **Activity Heatmap**: Visual representation of commit patterns
- **Export Options**: Generate reports for sharing or archival

### Keyboard Shortcuts

- `q` or `Esc` - Quit application
- `b` - Browse branches
- `s` - View statistics
- `e` - Export options

## Terminal Compatibility

Bramble automatically detects your terminal capabilities and adjusts the character set accordingly. However, if you experience display issues with special characters (box drawing, progress bars), you can force ASCII mode:

```bash
# Force ASCII mode for maximum compatibility
bramble analyze . --ascii
```

### Common Display Issues

**Windows Command Prompt/PowerShell**:

- Box drawing characters may appear as question marks or squares
- Progress bars may show incorrectly
- **Solution**: Use `--ascii` flag or switch to Windows Terminal

**Font Issues**:

- Ensure your terminal uses a font that supports Unicode box drawing characters
- Recommended fonts: Consolas, Fira Code, JetBrains Mono, Cascadia Code

**VS Code Integrated Terminal**:

- Usually displays Unicode characters correctly
- If issues persist, check terminal font settings

### Supported Character Sets

- **Unicode Mode** (default): Rich visual experience with box drawing and block characters
- **ASCII Mode** (`--ascii`): Maximum compatibility using basic ASCII characters only

## Development

### Prerequisites

- Node.js 18+
- Git repository access

### Setup

```bash
git clone <repository-url>
cd bramble
npm install
npm run build
```

### Scripts

```bash
npm run dev        # Development mode with ts-node
npm run build      # Compile TypeScript
npm run start      # Run compiled version
npm run test       # Run tests
npm run lint       # Lint code
```

## Progress Indicators

Bramble provides real-time feedback during analysis, especially useful for repositories with many branches:

### Features

- **Visual Progress Bars**: Show completion percentage and current progress
- **ETA Calculation**: Estimates time remaining for repositories with >10 branches  
- **Branch-by-Branch Progress**: Displays which branch is currently being analyzed
- **Initialization Spinner**: Animated feedback during repository setup

### Examples

**Normal Mode** (default):

```text
🌿 Bramble - Git Branch Analysis Tool
Repository analysis: [████████████████████████████████████████] (4/4) - Repository metadata collected

Analyzing 25 branches: [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 32.0% (8/25) ETA: 12s - feature/user-auth
```

**Quiet Mode** (for scripts):

```bash
npx @risadams/bramble analyze . --quiet
```

**Verbose Mode** (detailed output):

```bash
npx @risadams/bramble analyze . --verbose
```

## Configuration

Create a `.bramblerc` file in your home directory for custom settings:

```json
{
  "staleDays": 30,
  "defaultExportFormat": "markdown",
  "theme": "dark"
}
```

## Architecture

Bramble follows a modular architecture with clear separation of concerns:

- **Core**: Git analysis engine (`GitAnalyzer`)
- **UI**: Terminal interface using blessed (`TerminalUI`)
- **Services**: Export and reporting functionality (`ExportService`)
- **Utils**: Validation and utility functions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

### ✅ Completed (v1.3.0)

- [x] Repository Health Monitoring - 6-dimension health analysis with actionable insights
- [x] Enhanced Visualizations - Branch trees, activity heatmaps, timelines, and interactive dashboards
- [x] Advanced Configuration System - Profiles, environments, and templates for enterprise workflows
- [x] Progress indicators with ETA calculation
- [x] Quiet mode for automated scripts and CI/CD
- [x] Enhanced user experience with real-time feedback

### 🚀 Upcoming Features

- [ ] Advanced branch comparison features
- [ ] Integration with GitHub/GitLab APIs
- [ ] Custom analysis rules and filters
- [ ] Performance optimizations for large repositories
- [ ] Plugin system for extensibility
- [ ] Branch dependency visualization
- [ ] Automated stale branch cleanup suggestions
- [ ] Network graphs for branch relationships
- [ ] Git flow diagram generation
- [ ] Advanced export formats (PDF, PowerBI, Tableau)
