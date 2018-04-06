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

  const { room } = await Room.getActiveRoom(channelId);
  if (room) {
    if (Room.shouldSetRoomAsInactive(room)) {
      await Room.setRoomInactive(room);
    } else {
      return await Promise.all([
        RoomsSlackMessages.deleteMessage(channelId, eventTs),
        RoomsSlackMessages.dispatchActiveRoomPresentEphemeralMessage(channelId, userId),
      ]);
    }
  }


  return await Room.create(channelId, userId, roomType);
});
