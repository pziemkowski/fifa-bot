import { curry, has } from 'ramda';

import * as Room from '../../../models/room';
import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Join Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest, queryResult } = req.body;
  const { intentDetectionConfidence } = queryResult;
  const { channelId, userId, eventTs } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  if (intentDetectionConfidence < 0.7) {
    return;
  }

  const { roomId, room } = await Room.getActiveRoom(channelId);
  if (!room) {
    await RoomsSlackMessages.deleteMessage(channelId, eventTs);

    return RoomsSlackMessages.dispatchNoActiveRoomsEphemeralMessage(channelId, userId);
  }

  const { committed, roomMembers } = await Room.addMember(roomId, room, userId);
  if (!committed) {
    await RoomsSlackMessages.deleteMessage(channelId, eventTs);

    if (has(userId, roomMembers)) {
      return RoomsSlackMessages.dispatchAlreadyJoinedEphemeralMessage(channelId, userId);
    }

    if (Room.isFull(room, roomMembers)) {
      return RoomsSlackMessages.dispatchRoomIsFullEphemeralMessage(channelId, userId);
    }

    return RoomsSlackMessages.dispatchCouldNotJoinEphemeralMessage(channelId, userId);
  }
});
