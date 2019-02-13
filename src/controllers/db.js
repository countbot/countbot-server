// api/src/controllers/db.js

// import axios from 'axios';
import logger from '../config/logger';
import driver from '../config/neo4j-driver';
import config from '../config';

const {
  gm: {
    token,
    groupId,
  },
} = config;

async function runCypher(arr, dr) {
  const session = dr.session();
  const resArray = [];
  for (const query of arr) { /* eslint no-restricted-syntax: 1 */
    await session.writeTransaction(tx => tx.run(query)) /* eslint no-await-in-loop: 1 */
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
    'MERGE (u:User {id:\'system\', name:\'GroupMe\'})',
    `MERGE (import:Import {id:1})
      SET import.page = 1,
      import.url = 'https://api.groupme.com/v3/groups?per_page=500&omit=memberships&page=' + import.page,
      import.token = '${token}'`,
  ];

  const result = await runCypher(setupCypher, driver);
  logger.info(result.map(x => x.records));
  res.send(result.map(x => x.records));
};

exports.refresh = async (req, res) => {
  const duration = req.query.depth ? req.query.depth : 'P1W';
  const refreshCypher = [
    `MERGE (import:Import {id:1})
      SET import.page = 1,
      import.url = 'https://api.groupme.com/v3/groups?per_page=500&omit=memberships&page=' + import.page,
      import.gList = []`,
    `CALL apoc.periodic.commit("MATCH (import:Import {id:1})
      CALL apoc.load.jsonParams(import.url,{\`X-Access-Token\`:import.token}, null) YIELD value
      SET import.page = import.page + 1,
      import.url = 'https://api.groupme.com/v3/groups?per_page=500&omit=memberships&page=' + import.page,
      import.gList = import.gList + EXTRACT(x in value.response | x.group_id)
      WITH value
      UNWIND value.response AS row
        MERGE (g:Group {id:row.group_id})
        SET g.name = row.name,
          g.description = row.description,
          g.imageUrl = row.image_url
        RETURN CASE
          WHEN count(row) < 500 THEN 0
          ELSE count(row)
        END as count",
      {}) YIELD updates, executions, runtime, batches, failedBatches, batchErrors, failedCommits, commitErrors`,
    `MATCH (import:Import {id: 1})
      SET import.url = 'https://api.groupme.com/v3/groups/'`,
    `CALL apoc.periodic.iterate("MATCH (import:Import {id:1}) UNWIND import.gList as gI RETURN gI",
      "MATCH (import:Import {id:1})
      CALL apoc.load.jsonParams(import.url + gI,{\`X-Access-Token\`:import.token}, null) YIELD value
      WITH value, gI as gId, import
      UNWIND value.response.members AS row
      MATCH (g:Group {id:gId})
      MERGE (u:User {id:row.user_id})
      MERGE (u)-[r:MEMBER_OF]->(g)
      SET u.name = row.name,
      r.nickname = row.nickname,
      r.avatarUrl = row.image_url",
      {batchSize:1, parallel:false, retries:2})`,
    `MATCH (import:Import {id:1})
      SET import.page = 0,
        import.url = 'https://api.groupme.com/v3/groups/' + import.gList[import.page] + '/messages?limit=100',
        import.count = 100,
        import.messageId = null`,
    `CALL apoc.periodic.commit("MATCH (import:Import {id:1})
      WITH import, import.page AS page
      CALL apoc.load.jsonParams(import.url,{\`X-Access-Token\`:import.token}, null) YIELD value
      SET import.page = CASE
        WHEN size(value.response) = 0 THEN import.page + 1
        WHEN datetime({ epochSeconds: COALESCE(last(value.response.messages).created_at, 9999999999) }) < datetime() - duration('${duration}') THEN import.page + 1
        WHEN import.count >= value.response.count THEN import.page + 1
        ELSE import.page
      END,
      import.messageId = CASE
        WHEN size(value.response) = 0 THEN null
        WHEN datetime({ epochSeconds: COALESCE(last(value.response.messages).created_at, 9999999999) }) < datetime() - duration('${duration}') THEN null
        WHEN import.count >= value.response.count THEN null
        ELSE last(value.response.messages).id
      END,
      import.url = 'https://api.groupme.com/v3/groups/' + import.gList[import.page] + '/messages?limit=100' + COALESCE('&before_id=' + import.messageId, ''),
      import.count = CASE
        WHEN size(value.response) = 0 THEN 100
        WHEN datetime({ epochSeconds: COALESCE(last(value.response.messages).created_at, 9999999999) }) < datetime() - duration('${duration}') THEN 100
        WHEN import.count >= value.response.count THEN 100
        ELSE import.count + 100
      END
      WITH value.response.messages as messages, import.gList[page] as gId, import
      MATCH (g:Group {id:gId})
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
      RETURN CASE
        WHEN import.page >= size(import.gList) THEN 0
        ELSE 1
      END as count",
      {}) YIELD updates, executions, runtime, batches, failedBatches, batchErrors, failedCommits, commitErrors`,
  ];
  const result = await runCypher(refreshCypher, driver);
  logger.info(result.map(x => x.records));
  res.send(result.map(x => x.records));
};

exports.countQuery = (req, res) => {
  const gId = req.query.groupId ? req.query.groupId : groupId;
  const userId = req.query.userId ? req.query.userId : '.*';
  const userName = req.query.userName ? req.query.userName : '';
  const queryText = req.query.queryText ? req.query.queryText : '';
  const startDate = req.query.startDate ? req.query.startDate : '2000';
  const endDate = req.query.endDate ? req.query.endDate : '3000';
  const Cypher = [
    // Single User
    `
    MATCH (g:Group {id: '${gId}'})
    MATCH (g)<-[:POSTED_IN]-(m:Message)<-[:POSTED]-(u:User)
    WHERE m.text =~ '(?i).*${queryText}.*'
    AND u.id =~ '${userId}'
    AND u.name =~ '.*${userName}.*'
    AND m.timestamp > datetime('${startDate}')
    AND m.timestamp < datetime('${endDate}')
    RETURN u.name as User, COUNT(m) as Posts ORDER BY Posts DESC
    `,
    // Group
    `
    MATCH (g:Group {id: '${gId}'})
    MATCH (g)<-[:POSTED_IN]-(m:Message)
    WHERE m.text =~ '(?i).*${queryText}.*'
    AND m.timestamp > datetime('${startDate}')
    AND m.timestamp < datetime('${endDate}')
    RETURN COUNT(m) as Posts ORDER BY Posts DESC
    `,
    // All Users
    `
    MATCH (g:Group {id: '${gId}'})
    MATCH (g)<-[:POSTED_IN]-(m:Message)<-[:POSTED]-(u:User)
    WHERE m.text =~ '(?i).*${queryText}.*'
    AND m.timestamp > datetime('${startDate}')
    AND m.timestamp < datetime('${endDate}')
    RETURN u.name as User, COUNT(m) as Posts ORDER BY Posts DESC
    `,
  ];
  let c;

  if (userName === '' && userId === '.*') {
    [, c] = Cypher;
  } else if (userName.toUpperCase() === 'ALL') {
    [, , c] = Cypher;
  } else {
    [c] = Cypher;
  }

  const session = driver.session();
  session.readTransaction(tx => tx.run(c))
    .then((result) => {
      session.close();
      const records = result.records.map(r => r.toObject());
      // logger.info(JSON.stringify(records));
      res.send(records);
    });
};
