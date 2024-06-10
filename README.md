# Nodejs wrapper around [NKN Tuna](https://github.com/nknorg/tuna)

Allows using [NKN tuna](https://github.com/nknorg/tuna) directly from a nodejs script.

Example:

```js
import { startTuna, waitConnected } from 'tuna-for-node'

//starts the tuna process
await startTuna('entry', new URL('./config/', import.meta.url))

//awaits tuna is connected
const ip = await waitConnected()
console.log('IP:', ip)
```

## Installation

_requires node 20 or greater_

### npm

`npm install tuna-for-node`

### pnpm

`pnpm add tuna-for-node`

## What it does

It downloads the correct tuna release binary (based on the platform) from [Tuna releases](https://github.com/nknorg/tuna/releases/tag/v0.1.0). And uses a simple script to start/stop the process (using `spawn`).

## API

<a name="startTuna"></a>

## startTuna ⇒ <code>Promise&lt;void&gt;</code>

Starts the tuna client.

| Param         | Type                                                            | Description                                  |
| ------------- | --------------------------------------------------------------- | -------------------------------------------- |
| command       | <code>&#x27;entry&#x27;</code> \| <code>&#x27;exit&#x27;</code> |                                              |
| configDir     | <code>string</code> \| <code>URL</code>                         |                                              |
| ipChangeCB    | <code>function</code>                                           |                                              |
| validatePorts | <code>boolean</code>                                            | if it waits for the proxy port to be open    |
| restart       | <code>boolean</code>                                            | if it should restart tuna if already running |

<a name="waitConnected"></a>

## waitConnected ⇒ <code>Promise&lt;string&gt;</code>

Awaits tuna client being connected.

**Returns**: <code>Promise&lt;string&gt;</code> - the current ip

| Param         | Type                 | Description                                                                                  |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| validatePorts | <code>boolean</code> | if it waits for the proxy port to be open                                                    |
| start         | <code>boolean</code> | if tuna should be started if not running (throws error if false and tuna is already running) |

<a name="stopTuna"></a>

## stopTuna ⇒ <code>Promise&lt;void&gt;</code>

Stops the tuna client.

<a name="startTunaProxy"></a>

## startTunaProxy ⇒ <code>Promise&lt;TunaHandler&gt;</code>

Starts a tuna proxy (http or socks5), this mode allows starting multiple proxies and there is no interference between each process. Port is assigned randomly by OS, and one can retrieve it from the return value `listenPort`


## Known issues:

1. This package relies on reading the log output stream from tuna to determine if connected and to what ip.
   Due to the limitation of the output, there is no way to determine which serivce disconnects and connects belong to. So in the configuration you **must only have 1 service** defined, it will throw error otherwise
2. Tuna does not fail or report an error if the defined service binding port is already in use, so is up to you to make sure is not.

## Improvments for the future

- Ability to start multiple (currently the process is global, so only one at the time can be started). One of the limitations is config directory, currently at best I could do a global map per config directory. However looking at more general solution options
- Handle all errors from the tuna output
- Better docs for startTunaProxy
- implement similar solution for startTuna