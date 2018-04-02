import { curry } from 'ramda';

import * as Room from '../../../models/room';
import * as RoomsServices from '../../../services/rooms';
import * as roomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Leave Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { teamId, channelId, userId } = roomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  const isAnyRoomActive = await RoomsServices.isAnyActive(teamId, channelId);
  if (!isAnyRoomActive) {
    //TODO: Send ephemeral message to user explaining that there's no active room and if possible ask him if he wants to create one
    return;
  }

  const activeRoomId = await Room.getActiveId(teamId, channelId);
  await RoomsServices.removeMemberFromRoom(activeRoomId, userId);
});
