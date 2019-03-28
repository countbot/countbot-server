// api/src/controllers/bot.js

import axios from 'axios';
import logger from '../config/logger';
import groupGifs from '../config/group_gifs.json';
import indGifs from '../config/ind_gifs.json';
import config from '../config';

const {
  apiUrl,
  gm: {
    // groupId,
    countBotId,
    countessBotId,
  },
} = config;

const instance = axios.create({ baseURL: apiUrl });
const gmApi = axios.create({ baseURL: 'https://api.groupme.com' });

function postMessage(botId, msg) {
  return gmApi.post('/v3/bots/post', {
    bot_id: botId,
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
    /^#(?:\.([^.\n]*))?(?:\.([^.\n]*))?(?:\.([^.\n]*))?(?:\.([^\n]*))?/,
    /^Refresh_DB$/,
    /^Help$/i,
  ];

  if (text && messageRegex[0].test(text)) {
    const params = messageRegex[0].exec(text);
    // logger.info(`params: ${params}`);
    const userName = params[1];
    const startDate = params[2];
    const endDate = params[3];
    const queryText = params[4];

    instance.get('/count', {
      params: {
        userName,
        startDate,
        endDate,
        queryText,
      },
    })
      .then(async (result) => {
        // logger.info(JSON.stringify(result.data));
        if (result.data.length === 0) {
          postMessage(countBotId, 'Count Bot counts 0 messages matching those criteria.');
        } else {
          // eslint-disable-next-line no-restricted-syntax
          for (const x of result.data) {
            const u = x.User ? `${x.User} has posted ` : '';
            const m = `${x.Posts} messages`;
            const q = queryText ? ` containing "${queryText}"` : '';
            let d = '.';
            if (startDate && endDate) {
              d = ` between ${startDate} and ${endDate}.`;
            } else if (startDate) {
              d = ` since ${startDate}.`;
            } else if (endDate) {
              d = ` before ${endDate}.`;
            }
            // eslint-disable-next-line no-await-in-loop
            await postMessage(countBotId, `${u}${m}${q}${d}`);
          }
        }
      })
      .catch((error) => {
        logger.error(error.message);
        // res.status(500).send(error.message);
      });
  } else if (text && messageRegex[2].test(text)) {
    postMessage(countBotId, 'https://github.com/countbot/countbot-server#countbot');
  }
}

function celebrate(senderId) {
  // Check for Group Celebration
  instance.get('/count')
    .then((result) => {
      const { Posts: msgCount } = result.data[0];
      logger.info(`GroupCelebCount: ${msgCount}`);
      if ((msgCount + 1) % 10000 === 0 || /^(?=\d{4,})(\d)\1*$/.test(msgCount)) {
        gmApi.post('/v3/bots/post', {
          bot_id: countessBotId,
          text: `Message ${msgCount + 1}! Party Time!!!!`,
        })
          .then(() => {
            gmApi.post('/v3/bots/post', {
              bot_id: countessBotId,
              text: groupGifs[Math.floor(Math.random() * groupGifs.length)],
            })
              .catch((error) => {
                logger.error(error.message);
              });
          })
          .catch((error) => {
            logger.error(error.message);
          });
      }
      // res.status(result.status).send(result.data);
    })
    .catch((error) => {
      logger.error(error.message);
      // res.status(500).send(error.message);
    });

  // Check for Individual Celebration
  instance.get('/count', {
    params: {
      userId: senderId,
    },
  })
    .then((result) => {
      const {
        User: name,
        Posts: msgCount,
      } = result.data[0];

      // logger.info(`UserCelebCount: ${msgCount}`);
      if ((msgCount) % 1000 === 0 || /^(?=\d{4,})(\d)\1*$/.test(msgCount)) {
        gmApi.post('/v3/bots/post', {
          bot_id: countessBotId,
          text: `It's time to Celebrate! ${name} has reached ${msgCount} messages!!!!`,
        })
          .then(() => {
            gmApi.post('/v3/bots/post', {
              bot_id: countessBotId,
              text: indGifs[Math.floor(Math.random() * indGifs.length)],
            });
          });
      }
      // res.status(result.status).send(result.data);
    })
    .catch((error) => {
      logger.error(error.message);
      // res.status(500).send(error.message);
    });
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
  // logger.info(`${id}
  // ${postGroupId}
  // ${senderId}
  // ${text}
  // ${createdAt}`);

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
      celebrate(senderId);
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
      res.status(result.status).send(result.data);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
