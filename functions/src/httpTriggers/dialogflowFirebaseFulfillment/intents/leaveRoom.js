import { curry } from 'ramda';

import * as Room from '../../../models/room';
import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Leave Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest, queryResult } = req.body;
  const { intentDetectionConfidence } = queryResult;
  const { channelId, userId, eventTs } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  if (intentDetectionConfidence < 0.9) {
    return;
  }

  const { roomId, room } = await Room.getActiveRoom(channelId);
  if (!room) {
    return await RoomsSlackMessages.deleteMessage(channelId, eventTs);
  }

  const { committed } = await Room.removeMember(roomId, userId);
  if (!committed) {
    return await RoomsSlackMessages.deleteMessage(channelId, eventTs);
  }
});
