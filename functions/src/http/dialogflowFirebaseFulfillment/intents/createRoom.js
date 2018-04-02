import { curry } from 'ramda';
import * as RoomsServices from '../../../services/rooms';
import * as roomsSlackMessages from '../../../services/roomsSlackMessages';

export const name = 'Create Room';

export const handler = curry(async (req, agent) => {
  const { originalDetectIntentRequest } = req.body;
  const { teamId, channelId, userId } = roomsSlackMessages.extractMessageMetadata(originalDetectIntentRequest);

  const isAnyRoomActive = await RoomsServices.isAnyActive(teamId, channelId);
  if (isAnyRoomActive) {
    return;
  }

  await RoomsServices.createNewRoom(teamId, channelId, userId);
});
