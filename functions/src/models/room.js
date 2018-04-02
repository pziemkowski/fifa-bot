import admin from 'firebase-admin';
import { mergeDeepRight, mergeDeepLeft, has, keys, length, isNil } from 'ramda';


const rootRef = admin.database().ref('/');
const roomsRef = rootRef.child('rooms');
const roomMembersRef = rootRef.child('roomMembers');
const activeRooms = rootRef.child('activeRooms');

export const MAX_ROOM_SIZE = 4;
export const RECREATE_MESSAGE_TIMEOUT = 10 * 60;

export async function getActiveId(teamId, channelId) {
  const snapshot = await activeRooms.child(`${teamId}-${channelId}`).once('value');
  return snapshot.val();
}

export async function getById(roomId) {
  const snapshot = await roomsRef.child(roomId).once('value');
  return snapshot.val();
}

export async function getMembersCount(roomId) {
  const snapshot = await roomMembersRef.child(roomId).once('value');
  return snapshot.numChildren();
}

export async function create(teamId, channelId, memberId) {
  const { key: newRoomId } = roomsRef.push();

  await rootRef.update({
    [`rooms/${newRoomId}`]: {
      teamId,
      channelId,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      ownerId: memberId
    },
    [`roomMembers/${newRoomId}/${memberId}`]: true,
    [`activeRooms/${teamId}-${channelId}`]: newRoomId,
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

    if (length(keys(currentValue)) < MAX_ROOM_SIZE && !has(memberId, currentValue)) {
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

export async function isFull(roomId) {
  const memberCount = await getMembersCount(roomId);
  return memberCount === MAX_ROOM_SIZE;
}
