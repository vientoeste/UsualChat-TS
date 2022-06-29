/*
Example:
// / SERVER
import sio = module("socket.io");
import http = module("http");
const httpServer = http.createServer(app);
const io = sio.listen(httpServer);
io.sockets.on('connection', function (socket: sio.Socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});
httpServer.listen(app.get('port'), function () {
// / CLIENT
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io.connect('http:// localhost');
  socket.on('news', function (data) {
    console.log(data);
    socket.emit('my other event', { my: 'data' });
  });
</script>
{% endblock %}
*/
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
// <reference path="node.d.ts" />
declare class EventEmitter {
  // eslint-disable-next-line @typescript-eslint/ban-types
  addListener(event: string, listener: Function);
  // eslint-disable-next-line @typescript-eslint/ban-types
  on(event: string, listener: Function);
  // eslint-disable-next-line @typescript-eslint/ban-types
  once(event: string, listener: Function): void;
  // eslint-disable-next-line @typescript-eslint/ban-types
  removeListener(event: string, listener: Function): void;
  removeAllListeners(event: string): void;
  setMaxListeners(n: number): void;
  listeners(event: string): { Function; }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, ...args: any[]): void;
}

declare module 'socket.io' {
  export const version : string;
  export const protocol: number;
  export const clientVersion : string;
  export function listen(server : unknown, options? : ManagerOptions, fn?) : Manager;

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface SocketEmitter {}

  export interface Manager {
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    constructor (server, options : ManagerOptions);
    server : unknown;
    namespaces;
    sockets : SocketNamespace;
    settings : ManagerOptions;
    store;
    log;
    static;
    get(key);
    set(key, value);
    enable(key);
    disable(key);
    enabled(key);
    disabled(key);
    configure(env, fn);
    // initStore();
    // onHandshake(id, data);
    // onConnect(id);
    // onOpen(id);
    // onDispatch(room, packet, volatile, exceptions);
    // onJoin(id, name);
    // onLeave(id, room);
    // onClose(id);
    // onClientDispatch(id, packet);
    // onClientMessage(id, packet);
    // onClientDisconnect(id, reason);
    // onDisconnect(id, reason);
    // handleRequest(req, res);
    // handleUpgrade(req, socket, head);
    // handleHTTPRequest(data, req, res);
    // handleClient(data, req);
    // generateId();
    // handleHandshake(data, req, res);
    // handshakeData(data);
    // verifyOrigin(request);
    // handlePacket(sessid, packet);
    // authorize(data, fn);
    // transports(data);
    // checkRequest(req);
    of(nsp);
    //  garbageCollection();
  }

  export interface SocketNamespace extends EventEmitter {
    manager;
    name;
    sockets;
    auth: boolean;
    clients(room) : unknown[];
    log;
    store;
    json : boolean;
    volatile: boolean;
    in(room) : SocketNamespace;
    to(room) : SocketNamespace;
    except(id) : SocketNamespace;
    // setFlags(): SocketNamespace;
    // packet(packet): SocketNamespace;
    send(data: unknown): SocketNamespace;
    socket(sid, readable?);
    authorization(fn): SocketNamespace;

    //  Events
    // eslint-disable-next-line @typescript-eslint/ban-types
    on(event: string, listener: Function): SocketNamespace;
    on(event: 'connection', listener: (err: Error, socket: Socket) => void): SocketNamespace;
  }

  export interface Socket extends EventEmitter {
    id;
    namespace : SocketNamespace;
    manager : Manager;
    disconnected : boolean;
    ackPackets: number;
    acks: unknown;
    readable: boolean;
    store;
    handshake;
    transport;
    log: boolean;
    json: boolean;
    volatile: Socket;
    broadcast : Socket;
    in(room) : SocketNamespace;
    to(room) : SocketNamespace;
    // setFlags();
    // onDisconnect(reason)
    join(name, fn) : Socket;
    leave(name, fn) : Socket;
    // packet(packet);
    // dispatch(packet, volatile);
    set(key, value, fn) : Socket;
    get(key, fn) : Socket;
    has(key, fn) : Socket;
    del(key, fn) : Socket;
    disconnect() : Socket;
    send(data, fn) : Socket;
    emit(name, ...arguments: unknown[]): Socket;

    //  Events
    // eslint-disable-next-line @typescript-eslint/ban-types
    on(event: string, callback: Function):Socket;
    on(event: 'disconnect', callback: (socket: Socket) => void):Socket;

  }

  export interface StoreClient {
    store : Store;
    id;

    // get(key, fn);
    // set(key, value, fn);
    // has(key, fn);
    // del(key, fn);
    // destroy(expiration);
  }

  export interface Store extends EventEmitter {
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    constructor (options);
    client(id) : StoreClient;
    destroyClient(id, expiration);
    destroy(expiration);

    // publish();
    // subscribe();
    // unsubscribe();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface MemoryStore extends Store { }
  export interface RedisStore extends Store {
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    constructor (opts: RedisStoreOptions);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Transport {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Static {
  }

  export interface RedisStoreOptions {
    // eslint-disable-next-line @typescript-eslint/ban-types
    nodeId?: Function; //  (fn) gets an id that uniquely identifies this node
    // eslint-disable-next-line @typescript-eslint/ban-types
    redis?: Function; //  (fn) redis constructor, defaults to redis
    redisPub?: unknown; //  (object) options to pass to the pub redis client
    redisSub?: unknown; //  (object) options to pass to the sub redis client
    redisClient?: unknown; //  (object) options to pass to the general redis client
    // eslint-disable-next-line @typescript-eslint/ban-types
    pack?: Function; //  (fn) custom packing, defaults to JSON or msgpack if installed
    // eslint-disable-next-line @typescript-eslint/ban-types
    unpack?: Function; //  (fn) custom packing, defaults to JSON or msgpack if installed
  }

  export interface ManagerOptions {
    origins?; //  : '*:*'
    log?; //  : true
    store? : Store; //  : new MemoryStore;
    logger?; //  : new Logger
    static?;//  : new Static(this)
    heartbeats?;//  : true
    resource?;//  : '/socket.io'
    transports?;//  : defaultTransports
    authorization?;// : false
    blacklist?;// : ['disconnect']
    // 'log level'?;// : 3
    // 'log colors'?;// : tty.isatty(process.stdout.fd)
    // 'close timeout'?;// : 60
    // 'heartbeat interval'?;// : 25
    // 'heartbeat timeout'?;// : 60
    // 'polling duration'?;// : 20
    // 'flash policy server'?;// : true
    // 'flash policy port'?;// : 10843
    // 'destroy upgrade'?;// : true
    // 'destroy buffer size'?;// : 10E7
    // 'browser client'?;// : true
    // 'browser client cache'?;// : true
    // 'browser client minification'?;// : false
    // 'browser client etag'?;// : false
    // 'browser client expires'?;// : 315360000
    // 'browser client gzip'?;// : false
    // 'browser client handler'?;// : false
    // 'client store expiration'?;// : 15
    // 'match origin protocol'?;// : false
  }
}
