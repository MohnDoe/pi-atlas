# @mohndoe/pi-atlas

Pi TUI extension providing an atlas of agent activity — costs, languages, models, projects, and tools from session logs.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
git clone https://github.com/mohndoe/pi-atlas.git
cd pi-atlas
bun install
ln -s "$(pwd)/src/index.ts" ~/.pi/agent/extensions/pi-atlas.ts
```

Then run `/reload` in pi or restart pi to pick up the extension. The `/atlas` command will be available.

### Dependencies

- [pi](https://pi.dev) v0.74–0.76
- Node.js 18+

## Usage

Type `/atlas` in pi to open the interactive Pi Atlas dashboard. The dashboard shows session statistics across five tabs: Overview, Languages, Models, Projects, and Usage.

Press `q` or `Escape` to close the dashboard.

## Contributing

This is a personal project. Issues and suggestions welcome via [GitHub issues](https://github.com/MohnDoe/pi-atlas/issues).

## License

[MIT](./LICENSE) © MohnDoe
