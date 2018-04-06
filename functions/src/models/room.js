import admin from 'firebase-admin';
import { mergeDeepRight, mergeDeepLeft, has, keys, length, isNil } from 'ramda';
import moment from 'moment/moment';


const rootRef = admin.database().ref('/');
const roomsRef = rootRef.child('rooms');
const roomMembersRef = rootRef.child('roomMembers');
const activeRoomsRef = rootRef.child('activeRooms');

export const ROOM_SIZE_2V2 = 4;
export const ROOM_SIZE_1V1 = 2;
export const RECREATE_MESSAGE_TIMEOUT = 3 * 60;
export const ACTIVE_ROOM_TIMEOUT = 30 * 60;


export async function getActiveRoom(channelId) {
  async function getActiveId(channelId) {
    const snapshot = await activeRoomsRef.child(channelId).once('value');
    return snapshot.val();
  }

  const roomId = await getActiveId(channelId);
  const unknownRoom = { roomId: null, room: null };
  if (!roomId) {
    return unknownRoom;
  }

  const room = await getById(roomId);
  if (!room) {
    return unknownRoom;
  }

  return { roomId, room };
}

export async function isAnyActive(channelId) {
  const { room } = await getActiveRoom(channelId);
  return !isNil(room);
}

export async function getById(roomId) {
  const snapshot = await roomsRef.child(roomId).once('value');
  return snapshot.val();
}

function getRoomSizeByType(roomType) {
  if (!roomType || roomType === '2v2') {
    return ROOM_SIZE_2V2;
  }

  if (roomType === '1v1') {
    return ROOM_SIZE_1V1;
  }
}

export async function create(channelId, memberId, roomType) {
  const { key: newRoomId } = roomsRef.push();

  await rootRef.update({
    [`rooms/${newRoomId}`]: {
      channelId,
      size: getRoomSizeByType(roomType),
      createdAt: admin.database.ServerValue.TIMESTAMP,
      ownerId: memberId
    },
    [`roomMembers/${newRoomId}/${memberId}`]: true,
    [`activeRooms/${channelId}`]: newRoomId,
  });

  return newRoomId;
}

export async function setRoomInactive(room) {
  await activeRoomsRef.child(room.channelId).set(null);
}

export function updateMessageTimestamp(roomId, timestamp) {
  return roomsRef.child(roomId).update({
    messageSlackTimestamp: timestamp,
    messageServerTimestamp: admin.database.ServerValue.TIMESTAMP,
  });
}

export async function addMember(roomId, room, memberId) {
  const { committed, snapshot } = await roomMembersRef.child(roomId).transaction((currentValue) => {
    if (!currentValue) {
      return { [memberId]: true };
    }

    if (length(keys(currentValue)) < room.size && !has(memberId, currentValue)) {
      return mergeDeepRight({ [memberId]: true }, currentValue);
    }

    return undefined;
  });

  return { committed, roomMembers: snapshot.val() };
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

  return { committed, roomMembers: snapshot.val() };
}

export function isFull(room, roomMembers) {
  const memberCount = length(keys(roomMembers));
  return memberCount === room.size;
}

export function shouldSetRoomAsInactive(room) {
  const now = moment.utc();
  const createdAt = moment(room.createdAt);

  return now.diff(createdAt, 'seconds') > ACTIVE_ROOM_TIMEOUT;
}

export function shouldDispatchNewMessage(room) {
  const { messageServerTimestamp } = room;
  if (!messageServerTimestamp) {
    return true;
  }

  const now = moment.utc();
  const createdAt = moment(messageServerTimestamp);
  return now.diff(createdAt, 'seconds') > RECREATE_MESSAGE_TIMEOUT;
}
