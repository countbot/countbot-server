// api/src/controllers/bot.js

import axios from 'axios';
import { runHttpQuery, convertNodeHttpToRequest } from 'apollo-server-core';
import server from '../config/apollo';
import logger from '../config/logger';
import config from '../config';

const {
  gm: {
    botId,
  },
} = config;

const gmApi = axios.create({ baseURL: 'https://api.groupme.com' });

function postMessage(bId, msg) {
  return gmApi.post('/v3/bots/post', {
    bot_id: bId,
    text: msg,
  })
    .then(() => {
      logger.info(`Message posted: ${msg}`);
    })
    .catch((error) => {
      logger.error(error.message);
    });
}

function parse(text) {
  const messageRegex = [
    /^!dashboard$/i,
    /^!roles$/i,
    /^!dobershrug$/i,
    /dash/i,
  ];

  if (text && messageRegex[0].test(text)) {
    postMessage(botId, 'https://werewolves.🍞🔪.ws');
  }
  if (text && messageRegex[1].test(text)) {
    postMessage(botId, 'https://docs.google.com/document/d/1-7rV6AaKfjeQM9LzRPL_1eg5m68ugRZuK3KGEuaae3o/edit?usp=sharing');
  }
  if (text && messageRegex[2].test(text)) {
    postMessage(botId, '¯\\_(ツ)_/¯');
  }
  if (text && messageRegex[3].test(text) && Math.random() < 0.25) {
    postMessage(botId, 'Regards 🤠');
  }
}

exports.post = async (req, res) => {
  const data = Object.assign({}, req.body);
  const {
    id,
    group_id: postGroupId,
    sender_id: senderId,
    text,
    created_at: dateSeconds,
  } = data;
  const createdAt = new Date(dateSeconds * 1000).toISOString();
  const contextValue = await server.createGraphQLServerOptions(req, res);

  runHttpQuery([req, res], {
    method: req.method,
    options: contextValue,
    query: {
      query: `mutation ($id: String!, $postGroupId: String!, $senderId: String!, $createdAt: String, $text: String) {
          CreateMessage(id: $id, timestamp: { formatted: $createdAt }, text: $text) {
            id
            timestamp {
              formatted
            }
            text
          }
          AddMessagePosted_by(from: {id: $senderId,}, to: {id: $id,}) {
            from {
              id
              name
            }
            to {
              id
            }
          }
          AddMessageGroup(from: {id: $id,}, to: {id: $postGroupId,}) {
            from {
              id
            }
            to {
              id
              name
            }
          }
        }`,
      variables: {
        id,
        postGroupId,
        senderId,
        createdAt,
        text,
      },
    },
    request: convertNodeHttpToRequest(req),
  })
    .then((result) => {
      parse(text);
      const socketId = [];
      const io = req.app.get('socketio');

      io.on('connection', (socket) => {
        socketId.push(socket.id);
        if (socketId[0] === socket.id) {
          // remove the connection listener for any subsequent
          // connections with the same ID
          io.removeAllListeners('connection');
        }
      });
      io.emit('message', id);
      // logger.info(JSON.stringify(result.data));
      res.status(200).send(result);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
