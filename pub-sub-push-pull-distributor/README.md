# PUB-SUB PUSH-PULL Distributor

## Rationale

Regular 0MQ REQ-REP is a synchronous ([blocking][b1]) connection.
It is not suitable for a service processing requests processed by multiple
services and completed at different times.  
We need a solution that would permit processing a request before the processing
of the previous request one has been completed.  Using PUB-SUB PUSH-PULL
connection enables REQ-REP like communication without  blocking limitation such
us REQ-REP lock-step.

[b1]: http://zguide.zeromq.org/page:all#Ask-and-Ye-Shall-Receive

## Demo

For best console log run in 3 separate terminals
```
node proxy-client.js
node service-client.js
node registry-server.js
```

> It is important you run `registry-client` before you run `service-client`

Run `registry-client` as the last service to keep PUB-SUB connection in sync.
Otherwise, registry will publish messages and because of missing subscribers they will be dropped.

If have similar architecture in production order of starting services doesn't really matter.
Some request will not be processed either way as it takes time to:
1. Startup the service.
2. Establish connection between services.

## Overview

PUB-SUB PUSH-PULL is a combination of messaging patterns:
* bi-directional PUSH-PULL providing asynchronous (not blocking) REQ-REP like
communication between the Proxy and the Registry allowing:
  * sending request for processing,
  * receiving completed results back
* combination of PUB-SUB and PUSH-PULL enabling:
  * broadcasting actions via PUB-SUB to connected Services,
  * collecting comlpeted results via PUSH-PULL, before sending it back
  the request proxy

 ```
 .  http(s)                                         +---------------+
     req/res             +---------------+       +---------------+  |
 +---------------+       |     PUB (3)   o--->---|  (4) SUB      |--+
 |               |       +---------------+       +---------------+  |
 |   Request     |       |               |       |               |  |
 |   proxy       |       |   Registry    |       |    Service    |  |
 |   client      |       |    server     |       |    client(s)  |  |
 |               |       |               |       |               |--+
 +---------------+       +---------------+       +---------------+  |
 |     PUSH (1)  |--->---o  (2) PULL (6) o---<---|  (5) PUSH     |--+
 +---------------+       +---------------+       +---------------+
 |     PULL (8)  |---<---o  (7) PUSH     |
 +---------------+       +---------------+
 ```

## Transport

Services use 2 part (multipart type) message to communicate.

### Message Header

First part of the message holds pattern information.
Message Header is simply a string that consists of 2 space separated parts:
* message type and
* message pattern string.

Example message headers:
```
REQ api/user/4
REP api/user/4
PREQ api/user/4?q=fname
PREP api/user/2?q=lname
```

#### Message type

* REQ - action request sent from *Proxy* (PUSH 1) to the Registry (PULL 2) and forwarded (PUB 3) to  a Service (SUB 4)
* REP - action reply sent from the Client (PUSH 5) to the Registry (PULL 6) and sent back (PUSH 7) to proxy
* PREQ - partial (internal) request sent from the Service (PUSH 5) to the Registry (PULL 6) and sent back (PUB 3) to another Service (SUB 4)
* PREP - partial (internal) reply sent from (PUSH) service and sent back (PUSH) to service

#### Message pattern

Action pattern is regular request string used for pattern matching.
It allows Service Clients to subscribe only to messages they are interested in, eg.:
```
api/user/4?q=fname
```


### Message data

Second part of the message stores data information.
It is expected to be a JSON string, regular stringified data object, eg.:
```
{"uri":"api/user/4","id":4}
```

## Components

### Request Client

* Parses and registers requests internally.
* Sends request action messages (PUSH).
* Collects request action results (PULL).
* Responds to original request, eg: responds to HTTP(s) request.

### Registry

* Collects required actions (PULL).
* Registers collected actions internally.
* Broadcasts collected actions (PUB) for processing.
* Receives processed results (PULL).
* Pushes back collected results (PUSH).

### Service(s)

* Listens for incoming action messages (SUB).
* Performs required actions.
* Sends result back to Registry (PUSH).

## Known limitations

This pattern requires additional implementation of handling more than one
service client subscribed to the same message pattern.

Request Client has been simplified for the demo purposes.
In practice it would require internal queuing to store incoming HTTP requests
until it receives REP message from the registry.