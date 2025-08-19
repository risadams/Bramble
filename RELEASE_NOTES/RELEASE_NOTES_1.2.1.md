# Release Notes - Bramble v1.2.1

## 🐛 Bug Fix Release

This patch release addresses a critical configuration bug and adds enhanced branch visibility features to improve the user experience when working with repositories that have both local and remote branches.

## 🛠 Critical Bug Fix

### Remote Branches Configuration

- **Fixed**: The `includeRemoteBranches` configuration option was not being properly respected in the GitAnalyzer
- **Impact**: Users who set `includeRemoteBranches=false` were still seeing remote branches in their analysis
- **Resolution**: Updated the branch data gathering logic to correctly filter remote branches based on user configuration

## ✨ New Features

### Branch Type Visibility

- **Branch Type Column**: Added a new "Type" column to the branch list view
  - Shows "LOCAL" for local branches
  - Shows "REMOTE" for remote branches  
  - Helps users quickly identify branch origins at a glance

- **Enhanced Repository Statistics**: The repository overview now provides detailed branch breakdowns:
  
  ```text
  Total Branches: 45
  - Local Branches: 42
  - Remote Branches: 3
  ```

### UI/UX Improvements

- **Improved Column Layout**: Adjusted branch list column widths to accommodate the new type information
- **Updated Legend**: Enhanced UI legend to explain the LOCAL vs REMOTE indicators
- **Better Information Density**: More context available without cluttering the interface

## 🔧 Technical Improvements

- **Type Safety**: Enhanced TypeScript type definitions with new `BranchType` enum
- **Robust Branch Handling**: Improved mapping between different Git reference formats (refs/heads/ vs refs/remotes/)
- **Configuration Validation**: Better validation and enforcement of the `includeRemoteBranches` setting

## 🎯 Use Case Benefits

### Repository Maintenance

- **Quick Remote Branch Identification**: Easily spot remote branches that may need cleanup
- **Local vs Remote Context**: Better understanding of branch distribution across local and remote repositories
- **Configuration Control**: Reliable filtering of remote branches when not needed

### Team Collaboration

- **Branch Origin Clarity**: Team members can quickly identify which branches are local vs pushed to remote
- **Workflow Optimization**: Better visibility into branch status for merge and cleanup decisions

## 🚀 Compatibility

- **Fully Backward Compatible**: No breaking changes from v1.2.0
- **Configuration Preserved**: All existing configuration settings remain unchanged
- **Performance**: No impact on analysis performance

## 🔄 Upgrade Guide

Simply update to v1.2.1 to get the bug fix and new features:

```bash
npm install -g @risadams/bramble@1.2.1
```

## ⚙️ Configuration

To control remote branch visibility:

```bash
# Include remote branches (default)
bramble config --set includeRemoteBranches=true

# Exclude remote branches  
bramble config --set includeRemoteBranches=false
```

## 🙏 Acknowledgments

Thank you to users who reported the remote branches configuration issue. This release ensures that Bramble respects your configuration preferences while providing better visibility into your repository's branch structure.

## 📋 Full Changelog

For a complete list of changes, see [CHANGELOG.md](../CHANGELOG.md).

---

## Download Bramble v1.2.1

- npm: `npm install -g @risadams/bramble@1.2.1`
- Source: Available on GitHub

## Questions or Issues?

- GitHub Issues: [Report a bug or request a feature](https://github.com/risadams/bramble/issues)
- Documentation: Check our comprehensive guides and examples
