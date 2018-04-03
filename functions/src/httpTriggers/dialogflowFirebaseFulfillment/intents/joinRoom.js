import { curry, has } from 'ramda';

import * as Room from '../../../models/room';
import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Join Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { channelId, userId, eventTs } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  const activeRoomId = await Room.getActiveId(channelId);
  if (!activeRoomId) {
    await RoomsSlackMessages.deleteMessage(channelId, eventTs);

    return RoomsSlackMessages.dispatchNoActiveRoomsEphemeralMessage(channelId, userId);
  }

  const room = await Room.getById(activeRoomId);
  const { committed, roomMembers } = await Room.addMember(activeRoomId, room, userId);

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
