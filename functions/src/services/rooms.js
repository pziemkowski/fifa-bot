import admin from 'firebase-admin';
import moment from 'moment';
import { isNil } from 'ramda';

import * as Room from '../models/room';
import * as RoomsSlackMessages from './roomsSlackMessages';

export async function isAnyActive(teamId, channelId) {
  const activeRoomId = await Room.getActiveId(teamId, channelId);
  return !isNil(activeRoomId);
}

export async function createNewRoom(teamId, channelId, userId) {
  const newRoomId = await Room.create(teamId, channelId, userId);
  const { ts } = await RoomsSlackMessages.dispatchNewRoomMessage(channelId, { [userId]: true });
  await Room.updateMessageTimestamp(newRoomId, ts);
}

async function shouldRecreateRoomMessage(roomId) {
  const room = await Room.getById(roomId);
  const now = moment.unix(admin.database.ServerValue.TIMESTAMP);

  const createdAt = moment.unix(room.messageServerTimestamp);
  return now.diff(createdAt, 'seconds') > Room.RECREATE_MESSAGE_TIMEOUT;
}

async function updateRoomMessage(roomId, roomMembers) {
  const { messageSlackTimestamp, channelId } = await Room.getById(roomId);

  if (await shouldRecreateRoomMessage(roomId)) {
    const { ts } = await RoomsSlackMessages.recreateRoomMessage(channelId, roomMembers, messageSlackTimestamp);
    await Room.updateMessageTimestamp(roomId, ts);
  } else {
    await RoomsSlackMessages.updateRoomMessage(channelId, roomMembers, messageSlackTimestamp);
  }
}

export async function addMemberToRoom(roomId, memberId) {
  const roomMembers = await Room.addMember(roomId, memberId);
  if (roomMembers) {
    await updateRoomMessage(roomId, roomMembers);
  }

  const isRoomFull = await Room.isFull(roomId);
  if (isRoomFull) {
    const { channelId, messageSlackTimestamp } = await Room.getById(roomId);
    await RoomsSlackMessages.dispatchGameReadyThreadMessage(channelId, roomMembers, messageSlackTimestamp);
  }
}

export async function removeMemberFromRoom(roomId, memberId) {
  const roomMembers = await Room.removeMember(roomId, memberId);
  if (roomMembers) {
    await updateRoomMessage(roomId, roomMembers);
  }
}
