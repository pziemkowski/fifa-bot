import { curry } from 'ramda';

import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';
import * as Room from '../../../models/room';

export const name = 'Create Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest, queryResult } = req.body;
  const { intentDetectionConfidence, parameters: { roomType } } = queryResult;
  const { channelId, userId, eventTs } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  if (intentDetectionConfidence < 0.7) {
    return;
  }

  if (await Room.isAnyActive(channelId)) {
    return await Promise.all([
      RoomsSlackMessages.deleteMessage(channelId, eventTs),
      RoomsSlackMessages.dispatchActiveRoomPresentEphemeralMessage(channelId, userId),
    ]);
  }

  await Room.create(channelId, userId, roomType);
});
