import { WebhookClient } from 'dialogflow-fulfillment';
import { map } from 'ramda';

import intents from './intents';

export default (request, response) => {
  const agent = new WebhookClient({
    request,
    response,
  });

  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  const handlers = new Map(map(
    ({ name, handler }) => [name, handler(request)]
  )(intents));

  agent.handleRequest(handlers);
};
