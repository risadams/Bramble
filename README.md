# Bramble

A terminal-based tool for advanced git branch analysis and visualization, providing insights into branch relationships, commit patterns, and repository health metrics.

## Features

- 🌿 **Advanced Branch Analysis**: Comprehensive analysis of all branches in your repository
- 📊 **Visual Statistics**: Interactive terminal dashboard with branch metrics
- 🔍 **Stale Branch Detection**: Identify abandoned or inactive branches
- 📈 **Activity Tracking**: Monitor commit patterns and contributor activity
- 📋 **Export Capabilities**: Generate reports in JSON, HTML, CSV, and Markdown formats
- ⚡ **Fast Performance**: Handles repositories with 100+ branches efficiently

## Installation

```bash
npm install -g bramble
```

## Usage

### Basic Analysis
```bash
bramble                    # Analyze current directory
bramble /path/to/repo     # Analyze specific repository
```

### Advanced Options
```bash
bramble -v                 # Verbose output
bramble -o html           # Export to HTML format
bramble --batch           # Batch mode for multiple repositories
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
