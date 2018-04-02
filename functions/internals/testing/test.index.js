import chai from 'chai';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

jest.mock('dialogflow-fulfillment', () => {
  class WebhookClient {
    handleRequest() {

    }
  }

  class Suggestion {

  }

  return { WebhookClient, Suggestion };
});