import { curry } from 'ramda';

export const name = 'Default Welcome Intent';

export const handler = curry((req, agent) => {
  agent.add(`Welcome to my agent!`);
});
