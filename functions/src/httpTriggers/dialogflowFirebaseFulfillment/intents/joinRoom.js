import { curry } from 'ramda';

import * as Room from '../../../models/room';
import * as RoomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Join Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { channelId, userId } = RoomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  const isAnyRoomActive = await Room.isAnyActive(channelId);
  if (!isAnyRoomActive) {
    return await RoomsSlackMessages.dispatchNoActiveRoomsEphemeralMessage(channelId, userId);
  }

  const activeRoomId = await Room.getActiveId(channelId);
  const roomMembers = await Room.addMember(activeRoomId, userId);
  if (!roomMembers) {
    await RoomsSlackMessages.dispatchCouldNotJoinEphemeralMessage(channelId, userId);
  }
});
