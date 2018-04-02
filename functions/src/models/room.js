import admin from 'firebase-admin';
import { mergeDeepRight, mergeDeepLeft, has, keys, length, isNil } from 'ramda';
import moment from 'moment/moment';


const rootRef = admin.database().ref('/');
const roomsRef = rootRef.child('rooms');
const roomMembersRef = rootRef.child('roomMembers');
const activeRooms = rootRef.child('activeRooms');

export const DEFAULT_MAX_ROOM_SIZE = 4;
export const RECREATE_MESSAGE_TIMEOUT = 3 * 60;

export async function getActiveId(channelId) {
  const snapshot = await activeRooms.child(`${channelId}`).once('value');
  return snapshot.val();
}

export async function isAnyActive(channelId) {
  const activeRoomId = await getActiveId(channelId);
  return !isNil(activeRoomId);
}

export async function getById(roomId) {
  const snapshot = await roomsRef.child(roomId).once('value');
  return snapshot.val();
}

export async function create(channelId, memberId) {
  const { key: newRoomId } = roomsRef.push();

  await rootRef.update({
    [`rooms/${newRoomId}`]: {
      channelId,
      size: DEFAULT_MAX_ROOM_SIZE,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      ownerId: memberId
    },
    [`roomMembers/${newRoomId}/${memberId}`]: true,
    [`activeRooms/${channelId}`]: newRoomId,
  });

  return newRoomId;
}

export function updateMessageTimestamp(roomId, timestamp) {
  return roomsRef.child(roomId).update({
    messageSlackTimestamp: timestamp,
    messageServerTimestamp: admin.database.ServerValue.TIMESTAMP,
  });
}

export async function addMember(roomId, memberId) {
  const { committed, snapshot } = await roomMembersRef.child(roomId).transaction((currentValue) => {
    if (!currentValue) {
      return { [memberId]: true };
    }

    if (length(keys(currentValue)) < DEFAULT_MAX_ROOM_SIZE && !has(memberId, currentValue)) {
      return mergeDeepRight({ [memberId]: true }, currentValue);
    }

    return undefined;
  });

  if (committed) {
    return snapshot.val();
  }

  return null;
}

export async function removeMember(roomId, memberId) {
  const { committed, snapshot } = await roomMembersRef.child(roomId).transaction((currentValue) => {
    if (!currentValue) {
      return currentValue;
    }

    if (has(memberId, currentValue)) {
      return mergeDeepLeft({ [memberId]: null }, currentValue);
    }

    return undefined;
  });

  if (committed) {
    return snapshot.val();
  }

  return null;
}

export function isFull(room, roomMembers) {
  const memberCount = length(keys(roomMembers));
  return memberCount === room.size;
}

export function shouldDispatchNewMessage(room, { timestampNow }) {
  const { messageServerTimestamp } = room;
  if (!messageServerTimestamp) {
    return true;
  }

  const now = moment.unix(timestampNow);
  const createdAt = moment.unix(messageServerTimestamp);
  return now.diff(createdAt, 'seconds') > RECREATE_MESSAGE_TIMEOUT;
}
