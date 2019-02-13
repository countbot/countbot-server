import { ApolloServer } from 'apollo-server-express';
import { makeAugmentedSchema } from 'neo4j-graphql-js';
import typeDefs from './graphql-schema';
import driver from './neo4j-driver';
import logger from './logger';

/*
 * Create an executable GraphQL schema object from GraphQL type definitions
 * including autogenerated queries and mutations.
 * Optionally a config object can be included to specify which types to include
 * in generated queries and/or mutations. Read more in the docs:
 * https://grandstack.io/docs/neo4j-graphql-js-api.html#makeaugmentedschemaoptions-graphqlschema
 */

const schema = makeAugmentedSchema({
  typeDefs,
});

/*
 * Create a new ApolloServer instance, serving the GraphQL schema
 * created using makeAugmentedSchema above and injecting the Neo4j driver
 * instance into the context object so it is available in the
 * generated resolvers to connect to the database.
 */
const server = new ApolloServer({
  context: { driver },
  schema,
  formatError: (error) => {
    logger.error(error);
    return error;
  },
  // formatResponse: (response) => {
  //   logger.info(JSON.stringify(response));
  //   return response;
  // },
});

export default server;
