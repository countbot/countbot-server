// api/src/index.js

// modules =====================================================================
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import socketIo from 'socket.io';
import config from './config';
import logger from './config/logger';
import router from './routes';
import server from './config/apollo';

const app = express();

// config =====================================================================
app.use(morgan('combined', { stream: logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// set port & environment
const { app: { port } } = config;
const { env } = config;

// routes =====================================================================
app.use('/', router);

server.applyMiddleware({ app });

// start app ==================================================================
const Server = app.listen(port);
logger.info(`App listening on port ${port} in ${env} mode...`);
logger.info(`GraphQL Server ready at ${server.graphqlPath}`);

// setup socket ===============================================================
const io = socketIo(Server);
io.on('connection', (socket) => {
  socket.emit('conn', 'Socket Connected');
  logger.info('Socket Connected');
});
app.set('socketio', io);

// expose app
export default app;
