import { curry } from 'ramda';

import * as Room from '../../../models/room';
import * as roomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Leave Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { channelId, userId } = roomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  const isAnyRoomActive = await Room.isAnyActive(channelId);
  if (!isAnyRoomActive) {
    return;
  }

  const activeRoomId = await Room.getActiveId(channelId);
  await Room.removeMember(activeRoomId, userId);
});
