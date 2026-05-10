# AquaTemp Homey App

A Homey SDK v3 app that integrates AquaTemp heat pumps via their cloud API. Forked from the original app by Jesper Rasmussen, currently at v1.9.0.

## What it does

- Polls the AquaTemp cloud API every 30 seconds for device data
- Reads temperatures (inlet, outlet, surrounding, coil, exhaust), power metrics (voltage, current, watts, cumulative energy), fan speed, thermostat mode, and alarm states
- Allows setting: target temperature (per HVAC mode), on/off, silent mode, HVAC mode (heat/cool/auto), and experimental fan/frequency settings
- Detects defrost mode and pump supply alarm via bit fields in the `2074` failure status register

## Architecture

```
app.ts                          # Homey app entry point
drivers/aquatemp/
  driver.ts                     # Device discovery / pairing
  device.ts                     # HeatPumpDevice — capability polling & listeners
  aquatempAPI.ts                # HTTP client wrapping the AquaTemp cloud REST API
  apirequestcodes.ts            # Protocol code constants (T01–T14, R01–R03, etc.)
  apiendpoints.ts               # Base URLs for login, device list, get/set data
  driver.*.compose.json         # Flow cards, settings, and driver manifest fragments
.homeycompose/
  app.json                      # App manifest (source of truth; app.json is generated)
  capabilities/                 # Custom capability definitions
hasher.ts                       # MD5 password hashing (first 16 chars of plain password)
```

## Key design decisions

- **No token caching across requests** — a new `AquatempAPI` instance is created on every poll and every write, so tokens are fetched fresh each time.
- **Experimental features** gated behind a device setting; capabilities are added/removed dynamically on toggle.
- **Energy meter** (`meter_power`) is accumulated in-process using elapsed time × watts. It resets on app restart and is approximate.
- **Temperature routing** — target temperature reads/writes are mode-aware: different API codes for heat (`R02`), cool (`R01`), and auto (`R03`).
- **Failure status** bit fields: register `2074` is a reversed binary string; bit 9 (charAt from end) = pump supply alarm, bit 15 = defrost.

## Build & tooling

```bash
npm run build   # tsc — compiles TypeScript
npm run lint    # eslint (athom config)
```

Homey compose is used: edit `.homeycompose/app.json` and `.homeycompose/capabilities/`, not `app.json` directly. Run `homey app compose` to regenerate `app.json`.

## Homey MCP

A Homey MCP server is connected to this project. Use it to interact with the live Homey during development:

- `list_devices` — inspect the paired AquaTemp device and its current capability values
- `list_flows` / `get_standard_flow` / `get_advanced_flow` — inspect existing automations
- `list_flow_trigger_cards` / `list_flow_condition_cards` / `list_flow_action_cards` — discover available flow cards (including those from this app)
- `set_devices_capabilities_values` — test capability writes against the real device
- `start_flow` — trigger flows to test end-to-end behaviour
- `create_standard_flow` / `create_advanced_flow` — create test flows during development

Always use the Homey MCP to verify changes against the live device rather than guessing at behaviour from the code alone.

## Conventions

- TypeScript strict mode is not enabled; avoid introducing `any` further than already present.
- Capability listener callbacks do the API write; `updateData()` does the full poll and reconciles all capabilities.
- Error types (`AuthenticationError`, `ApiRequestError`, `DeviceOfflineError`) are thrown from the API layer and caught in `device.ts` to set device availability.
- Flow card definitions live in `driver.flow.compose.json`; localisations live in `locales/en.json`.
