// api/src/controllers/db.js

import axios from 'axios';
import logger from '../config/logger';
import driver from '../config/neo4j-driver';
import config from '../config';

const {
  gm: {
    token,
    groupId,
    botId,
  },
} = config;

const gmApi = axios.create({ baseURL: 'https://api.groupme.com' });

async function runCypher(arr, dr) {
  const session = dr.session();
  const resArray = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const query of arr) {
    // eslint-disable-next-line no-await-in-loop
    await session.writeTransaction(tx => tx.run(query))
      .then(result => resArray.push(result));
  }
  session.close();
  return resArray;
}

exports.setup = async (req, res) => {
  const setupCypher = [
    'CREATE CONSTRAINT ON (n:Group) ASSERT exists(n.id)',
    'CREATE CONSTRAINT ON (n:Group) ASSERT n.id IS UNIQUE',
    'CREATE CONSTRAINT ON (n:User) ASSERT exists(n.id)',
    'CREATE CONSTRAINT ON (n:User) ASSERT n.id IS UNIQUE',
    'CREATE INDEX ON :User(name)',
    'CREATE CONSTRAINT ON (n:Message) ASSERT exists(n.id)',
    'CREATE CONSTRAINT ON (n:Message) ASSERT n.id IS UNIQUE',
    'CREATE CONSTRAINT ON (n:Game) ASSERT exists(n.id)',
    'CREATE CONSTRAINT ON (n:Game) ASSERT n.id IS UNIQUE',
    'MERGE (u:User {id:\'system\', name:\'GroupMe\'})',
    `MERGE (import:Import {id:1})
      SET import.token = '${token}'`,
  ];

  const result = await runCypher(setupCypher, driver);
  logger.info(result.map(x => x.records));
  res.send(result.map(x => x.records));
};

exports.refresh = async (req, res) => {
  const duration = req.query.depth ? req.query.depth : 'P10Y';
  const postMsg = req.query.postMsg ? parseInt(req.query.postMsg, 10) : 0;
  const refreshCypher = [
    `MATCH (import:Import {id:1})
      CALL apoc.load.jsonParams('https://api.groupme.com/v3/groups/${groupId}',{\`X-Access-Token\`:import.token}, null) YIELD value
      WITH value.response AS row
        MERGE (g:Group {id:row.group_id})
        SET g.name = row.name,
          g.description = row.description,
          g.imageUrl = row.image_url
      WITH row
      UNWIND row.members AS member
      MERGE (u:User {id:member.user_id})
      MERGE (u)-[r:MEMBER_OF]->(g)
      SET u.name = member.name,
      r.nickname = member.nickname,
      r.avatarUrl = member.image_url`,
    `MATCH (import:Import {id:1})
      SET import.url = 'https://api.groupme.com/v3/groups/${groupId}/messages?limit=100',
        import.count = 100,
        import.messageId = null`,
    `CALL apoc.periodic.commit("MATCH (import:Import {id:1})
      CALL apoc.load.jsonParams(import.url,{\`X-Access-Token\`:import.token}, null) YIELD value
      SET import.messageId = CASE
        WHEN size(value.response) = 0 THEN null
        WHEN import.count >= value.response.count THEN null
        ELSE last(value.response.messages).id
      END,
      import.url = 'https://api.groupme.com/v3/groups/${groupId}/messages?limit=100' + COALESCE('&before_id=' + import.messageId, ''),
      import.count = CASE
        WHEN size(value.response) = 0 THEN 100
        WHEN import.count >= value.response.count THEN 100
        ELSE import.count + 100
      END,
      import.done = CASE
        WHEN datetime({ epochSeconds: COALESCE(last(value.response.messages).created_at, 9999999999) }) < datetime() - duration('${duration}') THEN 0
        WHEN import.count >= value.response.count THEN 0
        ELSE 1
      END
      WITH value.response.messages as messages, import
      MATCH (g:Group {id:'${groupId}'})
      FOREACH (row in messages |
        MERGE (u:User {id:row.sender_id})
        ON CREATE SET u.name = row.name
        MERGE (m:Message {id:row.id})
        ON CREATE SET m.text = row.text,
          m.timestamp = datetime({ epochSeconds: row.created_at })
        MERGE (m)-[:POSTED_IN]->(g)
        MERGE (m)<-[:POSTED]-(u)
        FOREACH (liker in row.favorited_by |
          MERGE (l:User {id:liker})
          MERGE (l)-[:LIKED]->(m)
        )
        FOREACH (mention in row.attachments |
          FOREACH (mentionId in mention.user_ids |
            MERGE (mUser:User {id:mentionId})
            MERGE (mUser)<-[:MENTIONED]-(m)
          )
        )
      )
      RETURN import.done",
      {}) YIELD updates, executions, runtime, batches, failedBatches, batchErrors, failedCommits, commitErrors`,
  ];
  const result = await runCypher(refreshCypher, driver);
  if (postMsg) {
    gmApi.post('/v3/bots/post', {
      bot_id: botId,
      text: 'Database counts updated.',
    })
    // .then((result) => {
    //   logger.info(`Message posted: ${msg}`);
    // })
      .catch((error) => {
        logger.error(error.message);
      });
  }
  logger.info(result.map(x => x.records));
  res.send(result.map(x => x.records));
};

exports.roles = async (req, res) => {
  const rolesCypher = [
    `LOAD CSV WITH HEADERS FROM "https://docs.google.com/spreadsheets/d/1eCtw8w1EU18r-UEzb6nH9cn92zCTVAyW1XQDfpnZXv0/export?format=csv" AS row
      FIELDTERMINATOR ','
      MERGE (g:Game {id: row.Game})
      SET g.theme = row.Theme,
        g.startTime = datetime(row.Start),
        g.endTime = datetime(row.End),
        g.winner = row.Winner
      WITH g,
        split(row.Wolves, ";") AS wolves,
        split(row.Seer, ";") AS seers,
        split(row.Villagers, ";") AS villagers
      UNWIND wolves AS w
        MATCH (u:User {id:w})
        MERGE (g)<-[p:PLAYED_IN]-(u)
        SET p.role = ['Wolf']
      WITH g, seers, villagers
      FOREACH(s IN seers |
        MERGE (u:User {id:s})
        MERGE (g)<-[p:PLAYED_IN]-(u)
        SET p.role = ['Seer', 'Villager']
        )
      WITH g, villagers
      UNWIND villagers AS v
        MATCH (u:User {id:v})
        MERGE (g)<-[p:PLAYED_IN]-(u)
        SET p.role = ['Villager']
      WITH g
      MATCH (:Group {id: '47203471'})<-[:POSTED_IN]-(m:Message)
      WHERE m.timestamp > g.startTime
      AND m.timestamp < g.endTime
      MERGE (m)-[:PART_OF]->(g)`,
  ];

  const result = await runCypher(rolesCypher, driver);
  logger.info(result.map(x => x.records));
  res.send(result.map(x => x.records));
};
