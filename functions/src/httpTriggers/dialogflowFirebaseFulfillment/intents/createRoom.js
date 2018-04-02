import { curry } from 'ramda';

import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';
import * as Room from '../../../models/room';

export const name = 'Create Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { channelId, userId } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  if (await Room.isAnyActive(channelId)) {
    return;
  }

  await Room.create(channelId, userId);
});
