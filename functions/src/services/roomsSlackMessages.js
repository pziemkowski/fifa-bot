const functions = require('firebase-functions');
const { WebClient } = require('@slack/client');
const humps = require('humps');
const { keys, defaultTo, range, reduce, concat, always, ifElse, equals, map, pipe, join } = require('ramda');

const slackClient = new WebClient(functions.config().slack['bot_user_access_token']);

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

  return slackClient.chat.postMessage({
    channel: channelId,
    text,
    attachments,
  });
}

export async function deleteRoomMessage(room) {
  const { channelId, messageSlackTimestamp } = room;
  if (!messageSlackTimestamp) {
    return null;
  }

  return slackClient.chat.delete({ channel: channelId, ts: messageSlackTimestamp });
}

export function updateRoomMessage(room, roomMembers) {
  const { channelId, messageSlackTimestamp } = room;
  const membersIds = keys(roomMembers);
  const attachments = getMessageAttachments(room, membersIds);
  const text = getMessageText(room, membersIds);

  return slackClient.chat.update({
    channel: channelId,
    ts: messageSlackTimestamp,
    text,
    attachments,
  });
}

export async function dispatchGameReadyThreadMessage(room, roomMembers) {
  const { channelId, messageSlackTimestamp } = room;
  await slackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageSlackTimestamp,
    text: pipe(
      keys,
      map((userId) => `<@${userId}>`),
      join(' ')
    )(roomMembers)
  });

  await slackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageSlackTimestamp,
    text: 'Game is ready! Go go go!',
  });
}

export async function dispatchCouldNotJoinEphemeralMessage(channelId, userId) {
  await slackClient.chat.postEphemeral({
    channel: channelId,
    text: 'Couldn\'t join the room, sorry!',
    user: userId,
  });
}

export async function dispatchNoActiveRoomsEphemeralMessage(channelId, userId) {
  await slackClient.chat.postEphemeral({
    channel: channelId,
    text: 'Currently there is no active room that you could join.',
    user: userId,
  });
}

export const extractMessageMetadata = (originalDetectIntentRequest) => {
  const { source, data } = originalDetectIntentRequest.payload;
  if (source === 'slack') {
    const { event } = humps.camelizeKeys(data);
    const { channel: channelId, user: userId } = event;

    return { channelId, userId };
  }

  throw new Error(`Event source ${source} not supported.`);
};