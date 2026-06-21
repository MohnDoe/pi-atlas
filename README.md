# pi-usage

Pi TUI extension for agent usage analytics — costs, languages, models, projects, and tools from session logs.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
git clone https://github.com/MohnDoe/pi-usage.git
cd pi-usage
npm install
ln -s "$(pwd)/src/index.ts" ~/.pi/agent/extensions/pi-usage.ts
```

Then run `/reload` in pi or restart pi to pick up the extension. The `/usage` command will be available.

### Dependencies

- [pi](https://pi.dev) v0.74–0.76
- Node.js 18+

## Usage

Type `/usage` in pi to open the interactive usage dashboard. The dashboard shows session statistics across five tabs: Overview, Languages, Models, Projects, and Usage.

Press `q` or `Escape` to close the dashboard.

## Contributing

This is a personal project. Issues and suggestions welcome via [GitHub issues](https://github.com/MohnDoe/pi-usage/issues).

## License

[MIT](./LICENSE) © MohnDoe
