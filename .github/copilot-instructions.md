# Bramble - Terminal Git Analysis Tool

## Project Overview
Bramble is a terminal-based tool for advanced git branch analysis and visualization, providing insights into branch relationships, commit patterns, and repository health metrics.

## Technical Stack
- **Language**: TypeScript with Node.js 18+
- **Terminal UI**: blessed for interactive interfaces
- **Git Operations**: simple-git for repository interaction
- **Architecture**: Modular design with separation of concerns
- **Export**: Support for JSON, HTML, CSV, and Markdown reports

## Key Features
- Advanced branch analysis and visualization
- ASCII branch tree diagrams and activity heatmaps
- Branch relationship graphs and statistics dashboards
- Stale branch detection and commit pattern analysis
- Interactive terminal interface with keyboard navigation
- Export capabilities for various formats

## Development Guidelines
- Use async/await patterns for all git operations
- Implement proper error handling and graceful degradation
- Focus on performance for repositories with 100+ branches
- Maintain modular architecture with clear separation of UI, git operations, analysis engine, and export functionality
- Follow TypeScript best practices with strict type checking

## Project Structure
```
src/
├── index.ts              # CLI entry point
├── app/
│   └── BrambleApp.ts     # Main application class
├── core/
│   └── GitAnalyzer.ts    # Git analysis engine
├── services/
│   └── ExportService.ts  # Export functionality
├── types/
│   └── config.ts         # Type definitions
├── ui/
│   └── TerminalUI.ts     # Terminal interface
└── utils/
    └── validation.ts     # Utility functions
```

## Available Commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with tsx
- `npm run start` - Run compiled version
- `npm run watch` - Watch mode compilation
- `npm run test` - Run tests
- `npm run lint` - Lint TypeScript files
