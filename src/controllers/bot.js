// api/src/controllers/bot.js

import axios from 'axios';
import logger from '../config/logger';
import config from '../config';

const {
  apiUrl,
  gm: {
    botId,
  },
} = config;

const instance = axios.create({ baseURL: apiUrl });
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
  ];

  if (text && messageRegex[0].test(text)) {
    postMessage(botId, 'https://werewolves.🍞🔪.ws');
  }
}

exports.post = (req, res) => {
  const data = Object.assign({}, req.body);
  const {
    id,
    group_id: postGroupId,
    sender_id: senderId,
    text,
    created_at: dateSeconds,
  } = data;
  const createdAt = new Date(dateSeconds * 1000).toISOString();

  instance.post('/graphql', {
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
  })
    .then((result) => {
      parse(text);
      // logger.info(JSON.stringify(result.data));
      res.status(result.status).send(result.data);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
