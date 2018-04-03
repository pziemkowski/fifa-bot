const functions = require('firebase-functions');
const { WebClient } = require('@slack/client');
const humps = require('humps');
const { keys, defaultTo, range, reduce, concat, always, ifElse, equals, map, pipe, join } = require('ramda');

const oauthSlackClient = new WebClient(functions.config().slack['oauth_access_token']);
const botSlackClient = new WebClient(functions.config().slack['bot_user_access_token']);

const getMessageAttachments = (room, membersIds) => {
  const membersCount = membersIds.length;
  return reduce(concat, [], [
    membersIds.map((userId) => ({
      text: `<@${userId}> is ready!`,
      color: '#4CAF50',
    })),
    range(membersCount, room.size).map(always({
      text: `Empty seat.`,
      color: '#F44336',
    })),
  ]);
};

const getMessageText = (room, membersIds) => ifElse(
  equals(room.size),
  always(`The game has started. Those are the players:`),
  always('Who wants to play?')
)(membersIds.length);

export function dispatchNewRoomMessage(room, roomMembers) {
  const { channelId } = room;
  const memberIds = keys(roomMembers);
  const attachments = getMessageAttachments(room, memberIds);
  const text = getMessageText(room, memberIds);

  return botSlackClient.chat.postMessage({
    channel: channelId,
    text,
    attachments,
  });
}

export function deleteMessage(channel, ts) {
  return oauthSlackClient.chat.delete({ channel, ts });
}

export function deleteRoomMessage(room) {
  const { channelId, messageSlackTimestamp } = room;
  if (!messageSlackTimestamp) {
    return null;
  }

  return deleteMessage(channelId, messageSlackTimestamp);
}


export function updateRoomMessage(room, roomMembers) {
  const { channelId, messageSlackTimestamp } = room;
  const membersIds = keys(roomMembers);
  const attachments = getMessageAttachments(room, membersIds);
  const text = getMessageText(room, membersIds);

  return botSlackClient.chat.update({
    channel: channelId,
    ts: messageSlackTimestamp,
    text,
    attachments,
  });
}

export async function dispatchGameReadyThreadMessage(room, roomMembers) {
  const { channelId, messageSlackTimestamp } = room;
  await botSlackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageSlackTimestamp,
    text: pipe(
      keys,
      map((userId) => `<@${userId}>`),
      join(' ')
    )(roomMembers)
  });

  await botSlackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageSlackTimestamp,
    text: 'The game is ready! Go go go!',
  });
}

export async function dispatchActiveRoomPresentEphemeralMessage(channelId, userId) {
  await botSlackClient.chat.postEphemeral({
    channel: channelId,
    text: "There's already a game open, join it instead of creating a new one!",
    user: userId,
  });
}

export async function dispatchAlreadyJoinedEphemeralMessage(channelId, userId) {
  await botSlackClient.chat.postEphemeral({
    channel: channelId,
    text: "You've already joined this game. Don't be so greedy!",
    user: userId,
  });
}

export async function dispatchRoomIsFullEphemeralMessage(channelId, userId) {
  await botSlackClient.chat.postEphemeral({
    channel: channelId,
    text: 'This game is already full, sorry!',
    user: userId,
  });
}

export async function dispatchCouldNotJoinEphemeralMessage(channelId, userId) {
  await botSlackClient.chat.postEphemeral({
    channel: channelId,
    text: "Couldn't join this game for some reason. Quick, blame someone!",
    user: userId,
  });
}

export async function dispatchNoActiveRoomsEphemeralMessage(channelId, userId) {
  await botSlackClient.chat.postEphemeral({
    channel: channelId,
    text: 'Currently there is no active game that you could join.',
    user: userId,
  });
}

export const extractMessageMetadata = (originalDetectIntentRequest) => {
  const { source, data } = originalDetectIntentRequest.payload;
  if (source === 'slack') {
    const { event } = humps.camelizeKeys(data);
    const { channel: channelId, user: userId, ts: eventTs } = event;

    return { channelId, userId, eventTs };
  }

  throw new Error(`Event source ${source} not supported.`);
};
