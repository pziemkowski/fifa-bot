import admin from 'firebase-admin';

import * as Room from '../models/room';
import * as RoomsSlackMessages from '../services/roomsSlackMessages';

/**
 *  Updates existing message or creates a new one if RECREATE_MESSAGE_TIMEOUT has been exceeded
 *
 * @param roomId An ID of a room
 * @param {Object} room Represents a room's data
 * @param {Object} roomMembers Represents members of a room. Each key is a Slack ID of a member
 * @returns {Promise<number>} A Promise resolved with either timestamp of existing message or of a new one if system
 * needed to recreate it
 */
const updateSlackMessage = async (roomId, room, roomMembers) => {
  const shouldDispatchNewMessage = Room.shouldDispatchNewMessage(room, {
    timestampNow: admin.database.ServerValue.TIMESTAMP,
  });

  if (shouldDispatchNewMessage) {
    await RoomsSlackMessages.deleteRoomMessage(room);

    const { ts } = await RoomsSlackMessages.dispatchNewRoomMessage(room, roomMembers);
    return ts;
  }

  await RoomsSlackMessages.updateRoomMessage(room, roomMembers);

  return room.messageSlackTimestamp;
};

export default async (event) => {
  const { roomId } = event.params;
  const roomMembers = event.data.val();
  const room = await Room.getById(roomId);

  if (!room) {
    return;
  }

  const messageSlackTimestamp = await updateSlackMessage(roomId, room, roomMembers);
  if (messageSlackTimestamp !== room.messageSlackTimestamp) {
    await Room.updateMessageTimestamp(roomId, messageSlackTimestamp);
  }

  if (Room.isFull(room, roomMembers)) {
    await RoomsSlackMessages.dispatchGameReadyThreadMessage({
      ...room,
      messageSlackTimestamp
    }, roomMembers);
  }
};
