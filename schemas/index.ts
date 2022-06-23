import mongoose = require('mongoose');

export function connectRepeat(dbid: string, dbpw: string, env: string) {
  if (env !== 'production') {
    mongoose.set('debug', true);
  }
  mongoose.connect(`mongodb://${dbid}:${dbpw}@127.0.0.1:27017/admin`, {
    dbName: 'usualchat',
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  }, (error) => {
    if (error) {
      console.log('MongoDB - connection failed', error);
    } else {
      console.log('MongoDB - connection successful');
    }
  });
}

export default function connect(dbid: string, dbpw: string, env: string): void {
  if (dbid === 'default' || dbpw === 'default' || env === 'default') {
    console.log('DB: params error(schemas/index, 23)');
    return;
  }
  connectRepeat(dbid, dbpw, env);

  mongoose.set('useCreateIndex', true);

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB - connection error', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB - connection retry(connection failed)');
    connect(dbid, dbpw, env);
  });
}
