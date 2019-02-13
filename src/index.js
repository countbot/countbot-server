// api/src/index.js

// modules =====================================================================
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
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
app.listen(port);
logger.info(`App listening on port ${port} in ${env} mode...`);
logger.info(`GraphQL Server ready at ${server.graphqlPath}`);

// expose app
export default app;
