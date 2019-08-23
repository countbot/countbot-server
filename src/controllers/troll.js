// api/src/controllers/troll.js

import axios from 'axios';
import { runHttpQuery, convertNodeHttpToRequest } from 'apollo-server-core';
import server from '../config/apollo';
import logger from '../config/logger';
import config from '../config';

const {
  gm: {
    groupId,
    token,
    // botId,
  },
} = config;

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
      // logger.info(JSON.stringify(nicknames));
      return nicknames;
    })
    .catch((error) => {
      logger.error(error.message);
    });
}

async function postMessage(gId, targetId, res) {
  const n = await getNicknames(gId);
  // console.log(targetId);
  return gmApi.post(`/v3/groups/${gId}/messages`, {
    message: {
      text: `🤨... That's pretty sus.
      Guys, I think it's gotta be @${n[targetId]}
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


exports.get = async (req, res) => {
  const contextValue = await server.createGraphQLServerOptions(req, res);

  runHttpQuery([req, res], {
    method: 'POST',
    options: contextValue,
    query: {
      query: `{
              msgs: Message(first: 10, orderBy: id_desc) {
                id
                p: posted_by {
                  id
                  name
                }
              }
            }`,
    },
    request: convertNodeHttpToRequest(req),
  })
    .then((result) => {
      const { graphqlResponse } = result;
      const { msgs } = JSON.parse(graphqlResponse).data;
      // console.info(msgs);
      let targetId = null;
      msgs.every((m) => {
        targetId = m.p.id;
        return m.p.id === 'system';
      });
      // logger.info(`target: ${targetId}`);
      postMessage(groupId, targetId, res);
    })
    .catch((error) => {
      logger.error(error.message);
      res.status(500).send(error.message);
    });
};
