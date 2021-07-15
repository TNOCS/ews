[![Open in Visual Studio Code](https://open.vscode.dev/badges/open-in-vscode.svg)](https://open.vscode.dev/TNOCS/ews)

# EWS

Early Warning System for First Responders

## Installation

Using `pnpm` (install with `npm i -g pnpm`):

```bash
pnpm i
```

Using `npm`:

```bash
npm i
```

## Run

```bash
npm run build:serve
```

## Converting JSON to AVRO schema's

Use the JSON examples in the SAS Data Model, convert them online via [AVRO-schema-from-JSON](https://toolslick.com/generation/metadata/avro-schema-from-json), and perform some manual tweaking, specifically make certain properties optional.

## Converting AVRO schema's to Typescript interface definitions

```bash
npm i -g avro-typescript-converter
# For each AVRO file
avro-typescript-converter.cmd resource-value.avsc -v
```
