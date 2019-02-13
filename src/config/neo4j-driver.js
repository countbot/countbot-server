import { v1 as neo4j } from 'neo4j-driver';
import config from '.';

const {
  db: {
    host,
    user,
    password,
  },
} = config;

/*
 * Create a Neo4j driver instance to connect to the database
 * using credentials specified as environment variables
 * with fallback to defaults
 */
const driver = neo4j.driver(
  host || 'bolt://localhost:7687',
  neo4j.auth.basic(
    user || 'neo4j',
    password || 'neo4j',
  ),
  { disableLosslessIntegers: true },
);

export default driver;
