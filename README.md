[![Open in Visual Studio Code](https://open.vscode.dev/badges/open-in-vscode.svg)](https://open.vscode.dev/TNOCS/ews)

# EWS

Early Warning System for First Responders: it listen to toxic plumes (from Kafka's `cbrn_geojson` topic) and resources (from Kafka's `resource` topic) and when a resource enters a toxic area, a message is sent (to Kafka's `message` topic).

## Installation

Using `pnpm` (install with `npm i -g pnpm`):

```bash
pnpm i
```

Using `npm`:

```bash
npm i
```

## Develop

```bash
npm start
```

## Build and run

```bash
npm run build
npm run ews
```
