import { WebhookClient } from 'dialogflow-fulfillment';
import { map } from 'ramda';

import intents from './intents';

function makeIntentHandlers(request) {
  const handlers = map(
    ({ name, handler }) => [name, handler(request)]
  )(intents);

  return new Map(handlers);
}

export default (request, response) => {
  const agent = new WebhookClient({ request, response });

  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  agent.handleRequest(makeIntentHandlers(request));
};
