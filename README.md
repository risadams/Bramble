# Bramble

<p align="center">
  <img width="1280" src="assets/logo_4x.png">
</p>

A terminal-based tool for advanced git branch analysis and visualization, providing insights into branch relationships, commit patterns, and repository health metrics.

## Features

- 🌿 **Advanced Branch Analysis**: Comprehensive analysis of all branches in your repository
- 📊 **Visual Statistics**: Interactive terminal dashboard with branch metrics
- 🔍 **Stale Branch Detection**: Identify abandoned or inactive branches
- 📈 **Activity Tracking**: Monitor commit patterns and contributor activity
- 📋 **Export Capabilities**: Generate reports in JSON, HTML, CSV, and Markdown formats
- ⚡ **Fast Performance**: Handles repositories with 100+ branches efficiently

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

# Batch processing
npx @risadams/bramble analyze . --batch           # Batch mode for multiple repos
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

- [ ] Advanced branch comparison features
- [ ] Integration with GitHub/GitLab APIs
- [ ] Custom analysis rules and filters
- [ ] Performance optimizations for large repositories
- [ ] Plugin system for extensibility
