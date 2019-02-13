// api/src/controllers/bot.js

import axios from 'axios';
import logger from '../config/logger';
import groupGifs from '../config/group_gifs.json';
import indGifs from '../config/ind_gifs.json';
import config from '../config';

const {
  apiUrl,
  gm: {
    groupId,
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
    // .then((result) => {
    //   logger.info(result.data);
    // })
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

    instance.get('/api/count', {
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
          for (const x of result.data) { /* eslint no-restricted-syntax: 1 */
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
            await postMessage(countBotId, `${u}${m}${q}${d}`); /* eslint no-await-in-loop: 1 */
          }
        }
      })
      .catch((error) => {
        logger.error(error.message);
        // res.status(500).send(error.message);
      });
  } else if (text && messageRegex[2].test(text)) {
    postMessage(countBotId, 'https://github.com/doberste8/countbot#countbot');
  }
}

function celebrate(senderId) {
  // Check for Group Celebration
  instance.post('/graphql', {
    query: `query ($groupId: String!){
              Group(id: $groupId) {
                msgCount
              }
            }`,
    variables: {
      groupId,
    },
  })
    .then((result) => {
      const { msgCount } = result.data.data.Group[0];
      // logger.info(`GroupCelebCount: ${msgCount}`);
      if ((msgCount) % 10000 === 0 || /^(?=\d{4,})(\d)\1*$/.test(msgCount)) {
        gmApi.post('/v3/bots/post', {
          bot_id: countessBotId,
          text: groupGifs[Math.floor(Math.random() * groupGifs.length)],
        })
          .then(() => {
            gmApi.post('/v3/bots/post', {
              bot_id: countessBotId,
              text: `Message ${msgCount + 1}! Party Time!!!!`,
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
  instance.get('/api/count', {
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
      if ((msgCount) % 10000 === 0 || /^(?=\d{4,})(\d)\1*$/.test(msgCount)) {
        gmApi.post('/v3/bots/post', {
          bot_id: countessBotId,
          text: indGifs[Math.floor(Math.random() * indGifs.length)],
        })
          .then(() => {
            gmApi.post('/v3/bots/post', {
              bot_id: countessBotId,
              text: `It's time to Celebrate! ${name} has reached ${msgCount} messages!!!!`,
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
      // logger.info(JSON.stringify(result.data));
      res.status(result.status).send(result.data);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
