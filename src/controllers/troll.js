// api/src/controllers/troll.js

import axios from 'axios';
import logger from '../config/logger';
import config from '../config';

const {
  apiUrl,
  gm: {
    groupId,
    token,
    // botId,
  },
} = config;

const instance = axios.create({ baseURL: apiUrl });
const gmApi = axios.create({ baseURL: 'https://api.groupme.com', headers: { 'X-Access-Token': token } });

function getNicknames(grId) {
  return gmApi.get(`/v3/groups/${grId}`)
    .then((response) => {
      // console.log(response);
      const { members } = response.data.response;
      const nicknames = {};
      members.forEach((m) => {
        nicknames[m.user_id] = m.nickname;
      });
      logger.info(JSON.stringify(nicknames));
      return nicknames;
    })
    .catch((error) => {
      logger.error(error.message);
    });
}

async function postMessage(gId, targetId, res) {
  const n = await getNicknames(groupId);
  console.log(targetId);
  return gmApi.post(`/v3/groups/${gId}/messages`, {
    message: {
      text: `🤨
      Guys, Wait!
      I'm pretty sure it's gotta be @${n[targetId]}
      That's the only way this all makes sense`,
      attachments: [{
        type: 'mentions',
        user_ids: [
          parseInt(targetId, 10),
        ],
        loci: [
          [0, 0],
        ],
      }],
    },
  })
    .then(() => {
      gmApi.post(`/v3/groups/${gId}/messages`, {
        message: {
          text: `Votemaj @${n[targetId]}`,
          attachments: [{
            type: 'mentions',
            user_ids: [
              parseInt(targetId, 10),
            ],
            loci: [
              [0, 0],
            ],
          }],
        },
      })
        .then(() => {
          logger.info(`${n[targetId]} voted for`);
          res.send(`${n[targetId]} voted for`);
        })
        .catch((error) => {
          logger.error(error.message);
          res.status(500).send(error.message);
        });
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
}


exports.get = (req, res) => {
  instance.post('/graphql', {
    query: `{
              msgs: Message(first: 10, orderBy: id_desc) {
                id
                p: posted_by {
                  id
                  name
                }
              }
            }`,
  })
    .then((result) => {
      const { msgs } = result.data.data;
      // console.info(msgs);
      let targetId = null;
      msgs.every((m) => {
        targetId = m.p.id;
        return m.p.id === 'system' || m.p.id === '764066';
      });
      // logger.info(`target: ${targetId}`);
      postMessage(30883038, targetId, res);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
